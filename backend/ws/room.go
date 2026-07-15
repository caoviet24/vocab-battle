package ws

import (
	"backend/models"
	"backend/repository"
	"errors"
	"strings"
	"sync"
	"time"
	"unicode"
)

type Player struct {
	ID    string `json:"player_id"`
	Name  string `json:"name"`
	Score int    `json:"score"`
}

// Game status constants — sync với client lib/store.ts
const (
	StatusLobby    = "LOBBY"
	StatusPlaying  = "PLAYING"
	StatusFinished = "FINISHED"
)

type Room struct {
	Code                 string
	Password             string // Mật khẩu phòng ("" = công khai)
	HostID               string // ID người chơi tạo phòng
	Hub                  *Hub
	Clients              map[*Client]bool
	Players              map[string]*Player
	Status               string // StatusLobby, StatusPlaying, StatusFinished
	ReadyPlayers         map[string]bool // Tập hợp player đã sẵn sàng tái đấu
	CurrentCards         []models.Card
	CurrentQuestionIndex int
	QuestionLocked       bool // Cờ khóa câu hỏi khi có người trả lời đúng
	Broadcast            chan Message
	Register             chan *Client
	Unregister           chan *Client
	Mutex                sync.Mutex
}

func NewRoom(code string, hub *Hub) *Room {
	return &Room{
		Code:         code,
		Hub:          hub,
		Clients:      make(map[*Client]bool),
		Players:      make(map[string]*Player),
		ReadyPlayers: make(map[string]bool),
		Status:       StatusLobby,
		Broadcast:    make(chan Message, 256), // buffered để tránh deadlock khi send từ Register case
		Register:     make(chan *Client),
		Unregister:   make(chan *Client),
	}
}

// SetPasswordAndHost cấu hình phòng khi Host tạo
func (r *Room) SetPasswordAndHost(password, hostID string) {
	r.Mutex.Lock()
	defer r.Mutex.Unlock()
	r.Password = password
	if r.HostID == "" {
		r.HostID = hostID
	}
}

// Chuyển Map thành Array để Next.js render Realtime chuẩn xác
func (r *Room) GetPlayersList() []*Player {
	players := make([]*Player, 0, len(r.Players))
	for _, p := range r.Players {
		players = append(players, p)
	}
	return players
}

// Snapshot trả về bản sao an toàn của Room (cho admin API)
func (r *Room) Snapshot() RoomInfo {
	r.Mutex.Lock()
	defer r.Mutex.Unlock()
	players := r.GetPlayersList()
	return RoomInfo{
		Code:        r.Code,
		Status:      r.Status,
		HostID:      r.HostID,
		HasPassword: r.Password != "",
		PlayerCount: len(players),
		Players:     players,
	}
}

func (r *Room) Run() {
	for {
		select {
		case client := <-r.Register:
			r.Mutex.Lock()
			// Mỗi player chỉ giữ một connection hoạt động trong room.
			for existing := range r.Clients {
				if existing.PlayerID == client.PlayerID {
					delete(r.Clients, existing)
					existing.Close()
				}
			}

			// Reconnect không tạo player hoặc broadcast JOINED lần nữa.
			isNewPlayer := false
			if _, exists := r.Players[client.PlayerID]; !exists {
				isNewPlayer = true
				r.Players[client.PlayerID] = &Player{ID: client.PlayerID, Name: client.PlayerName, Score: 0}
			}
			r.Clients[client] = true
			playerList := r.GetPlayersList() // Lấy mảng

			// Gửi riêng cho client mới: danh sách + cờ isHost để FE biết ai là host
			welcomePayload := map[string]interface{}{
				"players":     playerList,
				"is_host":     r.HostID == client.PlayerID,
				"has_password": r.Password != "",
			}
			select {
			case client.Send <- Message{Type: "ROOM_STATE", Payload: welcomePayload}:
			default:
			}
			r.Mutex.Unlock()

			// Chỉ broadcast JOINED khi có người MỚI thực sự, để các user khác cập nhật UI
			if isNewPlayer {
				r.Broadcast <- Message{Type: "PLAYER_JOINED", Payload: playerList}
				r.Hub.NotifyLobbyChange() // player_count thay đổi → lobby list cần refresh
			}

		case client := <-r.Unregister:
			r.Mutex.Lock()
			if _, ok := r.Clients[client]; ok {
				delete(r.Clients, client)
				client.Close()

				// Không xóa player nếu unregister này thuộc connection cũ vừa được thay thế.
				stillConnected := false
				for c := range r.Clients {
					if c.PlayerID == client.PlayerID {
						stillConnected = true
						break
					}
				}
				if !stillConnected {
					delete(r.Players, client.PlayerID)
				}

				if len(r.Clients) == 0 {
					// Không còn ai → xóa phòng
					r.Hub.RemoveRoom(r.Code)
					r.Mutex.Unlock()
					return
				}

				// ponytail: nếu host rời phòng HOÀN TOÀN (không còn connection nào) → đóng phòng
				if !stillConnected && client.PlayerID == r.HostID {
					// Gửi HOST_LEFT trực tiếp đến tất cả clients (synchronous) trước khi return
					hostLeftMsg := Message{Type: "HOST_LEFT", Payload: map[string]interface{}{
						"message": "Chủ phòng đã thoát. Phòng đã bị đóng.",
					}}
					for c := range r.Clients {
						select {
						case c.Send <- hostLeftMsg:
						default:
							c.Close()
							delete(r.Clients, c)
						}
					}
					r.Status = StatusFinished
					r.Hub.RemoveRoom(r.Code)
					r.Mutex.Unlock()
					return
				}

				playerList := r.GetPlayersList()

				// Nếu còn đúng 1 người → người đó thắng, quay về lobby
				if len(r.Clients) == 1 && r.Status == StatusPlaying {
					r.Status = StatusLobby
					r.CurrentCards = nil
					r.CurrentQuestionIndex = 0
					r.QuestionLocked = false
					r.Mutex.Unlock()

					// ponytail: gửi cho client duy nhất còn lại
					for c := range r.Clients {
						lastPlayer := r.Players[c.PlayerID]
						payload := map[string]interface{}{
							"winner_id":   lastPlayer.ID,
							"winner_name": lastPlayer.Name,
							"scoreboard":  playerList,
						}
						r.Broadcast <- Message{Type: "LAST_MAN_STANDING", Payload: payload}
						break
					}
					r.Hub.NotifyLobbyChange() // status → LOBBY
				} else {
					r.Mutex.Unlock()
					// Chỉ broadcast PLAYER_LEFT nếu player thực sự đã rời (không còn connection nào)
					if !stillConnected {
						r.Broadcast <- Message{Type: "PLAYER_LEFT", Payload: playerList}
						r.Hub.NotifyLobbyChange() // player_count thay đổi
					}
				}
			} else {
				r.Mutex.Unlock()
			}

		case message := <-r.Broadcast:
			r.Mutex.Lock()
			for client := range r.Clients {
				select {
				case client.Send <- message:
				default:
					client.Close()
					delete(r.Clients, client)
				}
			}
			r.Mutex.Unlock()
		}
	}
}

// StartGameFromHost: chỉ host mới start được, cần >=2 người; ready chỉ áp dụng khi tái đấu
func (r *Room) StartGameFromHost(hostID, categoryID string, total int) error {
	r.Mutex.Lock()
	if r.HostID != hostID {
		r.Mutex.Unlock()
		return errors.New("chỉ chủ phòng mới có thể bắt đầu")
	}
	if len(r.Players) < 2 {
		r.Mutex.Unlock()
		return errors.New("cần ít nhất 2 người chơi để bắt đầu")
	}
	if !r.playersReadyForStart() {
		r.Mutex.Unlock()
		return errors.New("chưa có tất cả người chơi sẵn sàng")
	}
	// Reset ready state cho lần sau
	r.ReadyPlayers = make(map[string]bool)
	r.Mutex.Unlock()

	if total <= 0 {
		total = 10
	}
	cards, err := repository.FetchRoundCards(categoryID, total)
	if err != nil || len(cards) == 0 {
		return errors.New("không lấy được câu hỏi")
	}

	r.Mutex.Lock()
	// Reset tất cả scores về 0 khi game mới bắt đầu
	for _, player := range r.Players {
		player.Score = 0
	}
	r.CurrentCards = cards
	r.CurrentQuestionIndex = 0
	r.Status = StatusPlaying
	r.QuestionLocked = false
	r.Mutex.Unlock()

	r.Hub.NotifyLobbyChange() // status → PLAYING
	r.SendNextQuestion()
	return nil
}

func (r *Room) playersReadyForStart() bool {
	if r.Status != StatusFinished {
		return true
	}
	for pid := range r.Players {
		if !r.ReadyPlayers[pid] {
			return false
		}
	}
	return true
}

func (r *Room) StartGame(categoryID string, total int) {
	if len(r.Players) < 2 {
		// Không cho start nếu chưa có ít nhất 2 người chơi
		return
	}
	cards, err := repository.FetchRoundCards(categoryID, total)
	if err != nil || len(cards) == 0 {
		return
	}

	r.Mutex.Lock()
	r.CurrentCards = cards
	r.CurrentQuestionIndex = 0
	r.Status = StatusPlaying
	r.QuestionLocked = false
	r.Mutex.Unlock()

	r.SendNextQuestion()
}

// VerifyPassword kiểm tra pass khi user join
// Trả về true nếu pass đúng hoặc phòng không có pass
func (r *Room) VerifyPassword(submitted string) bool {
	r.Mutex.Lock()
	defer r.Mutex.Unlock()
	if r.Password == "" {
		return true
	}
	return r.Password == submitted
}

// HasPassword báo phòng có pass hay không
func (r *Room) HasPassword() bool {
	r.Mutex.Lock()
	defer r.Mutex.Unlock()
	return r.Password != ""
}

func (r *Room) SendNextQuestion() {
	r.Mutex.Lock()
	if r.CurrentQuestionIndex >= len(r.CurrentCards) {
		r.Status = StatusFinished
		playerList := r.GetPlayersList()
		r.Mutex.Unlock()
		r.Broadcast <- Message{Type: "GAME_OVER", Payload: playerList}
		r.Hub.NotifyLobbyChange() // status → FINISHED
		return
	}

	currentCard := r.CurrentCards[r.CurrentQuestionIndex]
	r.QuestionLocked = false // Mở khóa khi qua câu mới
	r.Mutex.Unlock()

	// CHE ĐÁP ÁN, kèm thông tin vòng hiện tại
	// Mask từ cần đoán trong explanation vì có thể chứa từ đó
	maskedExplanation := models.BilingualText{
		En: maskWordInText(currentCard.Explanation.En, currentCard.Word),
		Vi: maskWordInText(currentCard.Explanation.Vi, currentCard.Word),
	}
	maskedExample := models.BilingualText{
		En: maskWordInText(currentCard.Example.En, currentCard.Word),
		Vi: maskWordInText(currentCard.Example.Vi, currentCard.Word),
	}

	roundInfo := map[string]interface{}{
		"card_id":      currentCard.ID.Hex(),
		"type":         currentCard.Type,
		"explanation":  maskedExplanation,
		"translation":  currentCard.Translation,
		"example":      maskedExample,
		"image_url":    currentCard.ImageURL,
		"word_length":  len([]rune(currentCard.Word)),
		"hint_pattern": generateHintPattern(currentCard.Word),
		"round":        r.CurrentQuestionIndex + 1,
		"total_rounds": len(r.CurrentCards),
	}
	r.Broadcast <- Message{Type: "NEXT_QUESTION", Payload: roundInfo}
}

// SendPhonetics gửi phonetics cho client khi họ bấm nghe
func (r *Room) SendPhonetics(playerID string) {
	r.Mutex.Lock()
	defer r.Mutex.Unlock()

	if r.Status != StatusPlaying || r.CurrentQuestionIndex >= len(r.CurrentCards) {
		return
	}

	currentCard := r.CurrentCards[r.CurrentQuestionIndex]
	payload := map[string]interface{}{
		"phonetics": currentCard.Phonetics,
	}
	// Gửi riêng cho client yêu cầu (tìm client theo playerID)
	for client := range r.Clients {
		if client.PlayerID == playerID {
			select {
			case client.Send <- Message{Type: "PHONETICS", Payload: payload}:
			default:
			}
			return
		}
	}
}

// generateHintPattern giữ khoảng trắng và chỉ cung cấp tối đa khoảng 1/3 đáp án.
func generateHintPattern(word string) string {
	runes := []rune(word)
	result := make([]rune, len(runes))
	letterPositions := make([]int, 0, len(runes))
	for i, char := range runes {
		if unicode.IsSpace(char) {
			result[i] = char
			continue
		}
		result[i] = '_'
		letterPositions = append(letterPositions, i)
	}

	revealCount := min((len(letterPositions)+2)/3, len(letterPositions)-1)
	for step := 1; step <= revealCount; step++ {
		position := letterPositions[step*len(letterPositions)/(revealCount+1)]
		result[position] = runes[position]
	}
	return string(result)
}

// maskWordInText ẩn từ cần đoán trong text, thay bằng **** (case-insensitive)
func maskWordInText(text, word string) string {
	if text == "" || word == "" {
		return text
	}
	masked := strings.Repeat("*", len(word))
	// Case-insensitive replace
	lowerText := strings.ToLower(text)
	lowerWord := strings.ToLower(word)
	result := ""
	idx := 0
	for {
		pos := strings.Index(lowerText[idx:], lowerWord)
		if pos == -1 {
			result += text[idx:]
			break
		}
		result += text[idx : idx+pos]
		result += masked
		idx += pos + len(word)
	}
	return result
}

// SetReady đánh dấu player sẵn sàng tái đấu
func (r *Room) SetReady(playerID string) {
	r.Mutex.Lock()
	defer r.Mutex.Unlock()
	r.ReadyPlayers[playerID] = true
	// Broadcast danh sách ready để các client khác cập nhật UI
	readyList := make([]string, 0, len(r.ReadyPlayers))
	for pid := range r.ReadyPlayers {
		readyList = append(readyList, pid)
	}
	r.Broadcast <- Message{Type: "READY_UPDATE", Payload: map[string]interface{}{
		"ready_count": len(readyList),
		"total":       len(r.Players),
		"ready_ids":   readyList,
	}}
}

func (r *Room) HandleAnswer(playerID string, answer string) {
	r.Mutex.Lock()
	// TỪ CHỐI nếu game chưa chạy hoặc câu hỏi ĐÃ BỊ KHÓA (đã có người trả lời đúng)
	if r.Status != StatusPlaying || r.QuestionLocked {
		r.Mutex.Unlock()
		return
	}

	currentCard := r.CurrentCards[r.CurrentQuestionIndex]
	expected := strings.TrimSpace(strings.ToLower(currentCard.Word))
	submitted := strings.TrimSpace(strings.ToLower(answer))

	if expected == submitted {
		// 1. KHÓA CÂU HỎI NGAY LẬP TỨC
		r.QuestionLocked = true
		r.Players[playerID].Score += 1
		r.CurrentQuestionIndex++

		// 2. Gửi full đáp án và bảng điểm mới về
		payload := map[string]interface{}{
			"winner_id":   playerID,
			"winner_name": r.Players[playerID].Name,
			"card":        currentCard,
			"scoreboard":  r.GetPlayersList(), // Lấy mảng để FE dễ render
		}
		r.Mutex.Unlock()

		r.Broadcast <- Message{Type: "CORRECT_ANSWER", Payload: payload}

		// 3. Đợi 3 giây rồi đi tiếp
		time.AfterFunc(3*time.Second, func() { r.SendNextQuestion() })
	} else {
		// Broadcast đáp án sai để các user khác thấy
		playerName := r.Players[playerID].Name
		r.Mutex.Unlock()

		wrongPayload := map[string]interface{}{
			"player_id":   playerID,
			"player_name": playerName,
			"answer":      answer,
		}
		r.Broadcast <- Message{Type: "WRONG_ANSWER", Payload: wrongPayload}
	}
}

// HandleTimeout xử lý khi hết thời gian, skip sang câu tiếp theo
func (r *Room) HandleTimeout(playerID string) {
	r.Mutex.Lock()
	// Chỉ skip nếu game đang chơi và câu hỏi chưa được trả lời
	if r.Status != StatusPlaying || r.QuestionLocked {
		r.Mutex.Unlock()
		return
	}

	// Khóa câu hỏi và chuyển sang câu tiếp
	r.QuestionLocked = true
	currentCard := r.CurrentCards[r.CurrentQuestionIndex]
	r.CurrentQuestionIndex++
	r.Mutex.Unlock()

	// Broadcast thông báo timeout với đáp án đúng
	payload := map[string]interface{}{
		"card":       currentCard,
		"scoreboard": r.GetPlayersList(),
	}
	r.Broadcast <- Message{Type: "TIMEOUT_SKIP", Payload: payload}

	// Đợi 3 giây rồi next question
	time.AfterFunc(3*time.Second, func() { r.SendNextQuestion() })
}
