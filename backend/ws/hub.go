package ws

import (
	"sync"
)

type Hub struct {
	Rooms map[string]*Room
	Mutex sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		Rooms: make(map[string]*Room),
	}
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
	defer h.Mutex.Unlock()
	delete(h.Rooms, roomCode)
}
