package db

import (
	"context"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var MongoClient *mongo.Client
var CardCollection *mongo.Collection
var CategoryCollection *mongo.Collection

func ConnectMongoDB(uri, dbName string) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		log.Fatalf("Lỗi kết nối MongoDB: %v", err)
	}

	if err := client.Ping(ctx, nil); err != nil {
		log.Fatalf("Không thể ping MongoDB: %v", err)
	}

	log.Println("✅ Kết nối MongoDB thành công!")
	MongoClient = client
	CardCollection = client.Database(dbName).Collection("cards")
	CategoryCollection = client.Database(dbName).Collection("categories")
}
