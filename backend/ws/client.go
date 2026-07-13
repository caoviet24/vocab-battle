package ws

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type Client struct {
	Room       *Room
	PlayerID   string
	PlayerName string
	Conn       *websocket.Conn
	Send       chan Message
}

func ServeWs(hub *Hub, w http.ResponseWriter, r *http.Request, roomCode, pID, pName, password, isHost string) {
	log.Printf("WebSocket request: room=%s, player=%s (%s), isHost=%s", roomCode, pID, pName, isHost)

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("❌ Upgrade failed: %v", err)
		return
	}

	var room *Room
	if isHost == "1" {
		// Host: tạo phòng (hoặc lấy nếu đã có)
		room = hub.GetOrCreateRoom(roomCode)
		room.SetPasswordAndHost(password, pID)
		log.Printf("✓ Host set for room %s: %s", roomCode, pID)
	} else {
		// Guest: phòng phải đã tồn tại (do host tạo trước đó)
		room = hub.GetRoom(roomCode)
		if room == nil {
			log.Printf("❌ Room not found: %s", roomCode)
			conn.WriteJSON(Message{Type: "ERROR", Payload: ErrorPayload{Code: "ROOM_NOT_FOUND", Message: "Phòng không tồn tại"}})
			conn.Close()
			return
		}
		// Verify pass ngay
		if !room.VerifyPassword(password) {
			log.Printf("❌ Wrong password for room %s from player %s", roomCode, pID)
			conn.WriteJSON(Message{Type: "ERROR", Payload: ErrorPayload{Code: "WRONG_PASSWORD", Message: "Sai mật khẩu phòng"}})
			conn.Close()
			return
		}
		log.Printf("✓ Password verified for player %s in room %s", pID, roomCode)
	}

	client := &Client{
		Room:       room,
		PlayerID:   pID,
		PlayerName: pName,
		Conn:       conn,
		Send:       make(chan Message, 256),
	}

	log.Printf("Registering client %s to room %s", pID, roomCode)
	client.Room.Register <- client
	go client.writePump()
	go client.readPump()
	log.Printf("✓ Client %s fully connected to room %s", pID, roomCode)
}

func (c *Client) readPump() {
	defer func() {
		c.Room.Unregister <- c
		c.Conn.Close()
	}()
	for {
		_, msg, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}
		var parsedMsg Message
		if err := json.Unmarshal(msg, &parsedMsg); err == nil {
			c.handleIncomingMessage(parsedMsg)
		}
	}
}

func (c *Client) writePump() {
	defer c.Conn.Close()
	for message := range c.Send {
		c.Conn.WriteJSON(message)
	}
}

// Điều hướng Logic dựa theo Event của Client gửi lên
func (c *Client) handleIncomingMessage(msg Message) {
	switch msg.Type {
	case "START_GAME":
		// Ép kiểu (Type Assertion) an toàn
		payloadBytes, _ := json.Marshal(msg.Payload)
		var p StartGamePayload
		json.Unmarshal(payloadBytes, &p)
		// Chỉ Host mới start được
		if err := c.Room.StartGameFromHost(c.PlayerID, p.CategoryID, p.TotalQuestions); err != nil {
			c.Send <- Message{Type: "ERROR", Payload: ErrorPayload{Code: "START_DENIED", Message: err.Error()}}
		}

	case "TIMEOUT":
		// Host báo timeout, skip sang câu tiếp
		c.Room.HandleTimeout(c.PlayerID)

	case "GET_PHONETICS":
		// User bấm nghe → server gửi phonetics
		c.Room.SendPhonetics(c.PlayerID)

	case "SUBMIT_ANSWER":
		payloadBytes, _ := json.Marshal(msg.Payload)
		var p AnswerPayload
		json.Unmarshal(payloadBytes, &p)
		c.Room.HandleAnswer(c.PlayerID, p.Answer)

	case "SET_READY":
		c.Room.SetReady(c.PlayerID)
	}
}
