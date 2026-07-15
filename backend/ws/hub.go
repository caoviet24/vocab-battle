package ws

import (
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Hub struct {
	Rooms map[string]*Room
	Mutex sync.RWMutex

	// Lobby clients — nhận danh sách phòng realtime thay vì poll REST
	lobbyClients map[*LobbyClient]bool
	lobbyMutex   sync.Mutex
	lobbyDirty   chan struct{}
}

func NewHub() *Hub {
	h := &Hub{
		Rooms:        make(map[string]*Room),
		lobbyClients: make(map[*LobbyClient]bool),
		lobbyDirty:   make(chan struct{}, 1),
	}
	go h.lobbyBroadcastLoop()
	return h
}

func (h *Hub) GetOrCreateRoom(roomCode string) *Room {
	h.Mutex.Lock()
	defer h.Mutex.Unlock()

	if room, exists := h.Rooms[roomCode]; exists {
		return room
	}

	room := NewRoom(roomCode, h)
	h.Rooms[roomCode] = room
	go room.Run()
	h.NotifyLobbyChange()
	return room
}

// GetRoom trả về room nếu đã tồn tại, nil nếu chưa (không tạo mới)
func (h *Hub) GetRoom(roomCode string) *Room {
	h.Mutex.RLock()
	defer h.Mutex.RUnlock()
	return h.Rooms[roomCode]
}

// RoomInfo là snapshot an toàn của Room để serialize ra JSON
type RoomInfo struct {
	Code        string    `json:"code"`
	Status      string    `json:"status"`
	HostID      string    `json:"host_id"`
	HasPassword bool      `json:"has_password"`
	PlayerCount int       `json:"player_count"`
	Players     []*Player `json:"players"`
}

// GetAllRooms trả về snapshot của tất cả rooms (cho admin)
func (h *Hub) GetAllRooms() []RoomInfo {
	h.Mutex.RLock()
	defer h.Mutex.RUnlock()

	rooms := make([]RoomInfo, 0, len(h.Rooms))
	for _, room := range h.Rooms {
		rooms = append(rooms, room.Snapshot())
	}
	return rooms
}

func (h *Hub) RemoveRoom(roomCode string) {
	h.Mutex.Lock()
	delete(h.Rooms, roomCode)
	h.Mutex.Unlock()
	h.NotifyLobbyChange()
}

// LobbyClient — connection chỉ nhận, theo dõi danh sách phòng trên home page
type LobbyClient struct {
	Hub       *Hub
	Conn      *websocket.Conn
	Send      chan Message
	Done      chan struct{}
	closeOnce sync.Once
}

func (lc *LobbyClient) Close() {
	lc.closeOnce.Do(func() {
		close(lc.Done)
		lc.Conn.Close()
	})
}

func (h *Hub) registerLobby(c *LobbyClient) {
	h.lobbyMutex.Lock()
	h.lobbyClients[c] = true
	h.lobbyMutex.Unlock()
	// Gửi snapshot ngay khi connect để client không phải đợi thay đổi đầu tiên
	select {
	case c.Send <- Message{Type: "ROOMS_UPDATE", Payload: h.GetAllRooms()}:
	default:
	}
}

func (h *Hub) unregisterLobby(c *LobbyClient) {
	h.lobbyMutex.Lock()
	delete(h.lobbyClients, c)
	h.lobbyMutex.Unlock()
	c.Close()
}

// NotifyLobbyChange đánh dấu snapshot lobby cần refresh, debounce 300ms để gộp nhiều thay đổi.
func (h *Hub) NotifyLobbyChange() {
	select {
	case h.lobbyDirty <- struct{}{}:
	default:
	}
}

func (h *Hub) lobbyBroadcastLoop() {
	for range h.lobbyDirty {
		time.Sleep(300 * time.Millisecond)
		for len(h.lobbyDirty) > 0 { // drain thêm signal gộp trong cửa sổ debounce
			<-h.lobbyDirty
		}
		h.broadcastLobby()
	}
}

func (h *Hub) broadcastLobby() {
	msg := Message{Type: "ROOMS_UPDATE", Payload: h.GetAllRooms()}
	h.lobbyMutex.Lock()
	defer h.lobbyMutex.Unlock()
	for client := range h.lobbyClients {
		select {
		case client.Send <- msg:
		default: // client chậm — bỏ qua, sẽ bị dọn qua readPump khi ngắt
		}
	}
}
