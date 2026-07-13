package ws

import (
	"backend/models"
	"testing"
	"time"
	"unicode"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestNextQuestionDoesNotLeakPhonetics(t *testing.T) {
	room := Room{
		CurrentCards: []models.Card{{
			ID:        primitive.NewObjectID(),
			Word:      "water",
			Phonetics: []models.Phonetic{{Text: "/water/", Audio: "audio.mp3"}},
		}},
		Broadcast: make(chan Message, 1),
	}

	room.SendNextQuestion()
	payload := (<-room.Broadcast).Payload.(map[string]interface{})
	if _, leaked := payload["phonetics_text"]; leaked {
		t.Fatal("NEXT_QUESTION must not contain phonetics")
	}
}

func TestGenerateHintPattern(t *testing.T) {
	for _, word := range []string{"cat", "language", "take part in"} {
		wordRunes := []rune(word)
		hintRunes := []rune(generateHintPattern(word))
		letters, revealed := 0, 0
		for i, char := range wordRunes {
			if unicode.IsSpace(char) {
				if hintRunes[i] != char {
					t.Fatalf("%q: space at %d was not preserved", word, i)
				}
				continue
			}
			letters++
			if hintRunes[i] != '_' {
				revealed++
			}
		}
		if revealed != min((letters+2)/3, letters-1) || revealed >= letters {
			t.Fatalf("%q: revealed %d of %d letters", word, revealed, letters)
		}
	}
}

func TestPlayersReadyForStart(t *testing.T) {
	players := map[string]*Player{"host": {}, "guest": {}}

	firstGame := Room{Status: StatusLobby, Players: players, ReadyPlayers: map[string]bool{}}
	if !firstGame.playersReadyForStart() {
		t.Fatal("first game must not require ready players")
	}

	rematch := Room{Status: StatusFinished, Players: players, ReadyPlayers: map[string]bool{"host": true}}
	if rematch.playersReadyForStart() {
		t.Fatal("rematch must require every player to be ready")
	}

	rematch.ReadyPlayers["guest"] = true
	if !rematch.playersReadyForStart() {
		t.Fatal("rematch must start when every player is ready")
	}
}

func TestFinishedRoomDisconnects(t *testing.T) {
	hub := NewHub()
	room := hub.GetOrCreateRoom("ROOM")
	room.SetPasswordAndHost("", "host")

	host := &Client{Room: room, PlayerID: "host", Send: make(chan Message, 16)}
	leavingGuest := &Client{Room: room, PlayerID: "guest-1", Send: make(chan Message, 16)}
	remainingGuest := &Client{Room: room, PlayerID: "guest-2", Send: make(chan Message, 16)}
	room.Register <- host
	room.Register <- leavingGuest
	room.Register <- remainingGuest
	waitForMessage(t, remainingGuest.Send, "ROOM_STATE")

	room.Mutex.Lock()
	room.Status = StatusFinished
	room.Mutex.Unlock()

	room.Unregister <- leavingGuest
	waitForMessage(t, host.Send, "PLAYER_LEFT")
	room.Mutex.Lock()
	_, guestStillPresent := room.Players[leavingGuest.PlayerID]
	room.Mutex.Unlock()
	if guestStillPresent {
		t.Fatal("guest must be removed after leaving a finished room")
	}

	room.Unregister <- host
	waitForMessage(t, remainingGuest.Send, "HOST_LEFT")
	deadline := time.Now().Add(time.Second)
	for hub.GetRoom(room.Code) != nil && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	if hub.GetRoom(room.Code) != nil {
		t.Fatal("room must be removed when host leaves")
	}
}

func waitForMessage(t *testing.T, messages <-chan Message, want string) {
	t.Helper()
	timer := time.NewTimer(time.Second)
	defer timer.Stop()
	for {
		select {
		case message := <-messages:
			if message.Type == want {
				return
			}
		case <-timer.C:
			t.Fatalf("timed out waiting for %s", want)
		}
	}
}
