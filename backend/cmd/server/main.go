package main

import (
	"backend/db"
	"backend/repository"
	"backend/ws"
	"log"
	"net/http"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	port := mustEnv("PORT")
	db.ConnectMongoDB(mustEnv("MONGO_URI"), mustEnv("DB_NAME"))

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

	log.Printf("🚀 Backend đang chạy ở cổng %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Lỗi khởi động server: %v", err)
	}
}

func mustEnv(name string) string {
	value := os.Getenv(name)
	if value == "" {
		panic("missing required environment variable: " + name)
	}
	return value
}
