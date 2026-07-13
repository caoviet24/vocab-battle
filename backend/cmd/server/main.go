package main

import (
	"backend/db"
	"backend/repository"
	"backend/ws"
	"cmp"
	"log"
	"net/http"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	db.ConnectMongoDB(
		cmp.Or(os.Getenv("MONGO_URI"), "mongodb://localhost:27017"),
		cmp.Or(os.Getenv("DB_NAME"), "vocab_battle"),
	)

	r := gin.Default()
	r.SetTrustedProxies(nil)
	r.Use(cors.Default())
	hub := ws.NewHub()

	r.GET("/api/categories", func(c *gin.Context) {
		categories, err := repository.FetchAllCategories()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Không lấy được danh sách categories"})
			return
		}
		c.JSON(http.StatusOK, categories)
	})

	r.GET("/api/admin/rooms", func(c *gin.Context) {
		c.JSON(http.StatusOK, hub.GetAllRooms())
	})

	r.GET("/ws/room/:roomCode", func(c *gin.Context) {
		roomCode := c.Param("roomCode")
		playerID := c.Query("playerId")
		playerName := c.Query("playerName")
		password := c.Query("password")
		isHost := c.Query("isHost")

		if playerID == "" || playerName == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Thiếu PlayerID hoặc PlayerName"})
			return
		}

		ws.ServeWs(hub, c.Writer, c.Request, roomCode, playerID, playerName, password, isHost)
	})

	log.Println("🚀 Backend đang chạy tại http://localhost:8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Lỗi khởi động server: %v", err)
	}
}
