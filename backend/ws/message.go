package ws

type Message struct {
	Type    string      `json:"type"` // ROOM_STATE, PLAYER_JOINED, PLAYER_LEFT, START_GAME, NEXT_QUESTION, SUBMIT_ANSWER, CORRECT_ANSWER, GAME_OVER, PASSWORD_REQUEST
	Payload interface{} `json:"payload"`
}

type AnswerPayload struct {
	Answer string `json:"answer"`
}

type StartGamePayload struct {
	CategoryID     string `json:"category_id"`
	TotalQuestions int    `json:"total_questions"`
}

type JoinRoomPayload struct {
	Password string `json:"password"`
}

type RoomStatePayload struct {
	Players      []*Player `json:"players"`
	IsHost       bool      `json:"is_host"`
	HasPassword  bool      `json:"has_password"`
}

type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}