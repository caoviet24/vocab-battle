package repository

import (
	"backend/db"
	"backend/models"
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// FetchAllCategories trả về tất cả categories
func FetchAllCategories() ([]models.Category, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := db.CategoryCollection.Find(ctx, bson.D{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var categories []models.Category
	if err := cursor.All(ctx, &categories); err != nil {
		return nil, err
	}
	return categories, nil
}

// FetchRoundCards lấy ngẫu nhiên N từ vựng (Hỗ trợ random toàn kho nếu categoryID = "random")
func FetchRoundCards(categoryIDStr string, limit int) ([]models.Card, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var pipeline mongo.Pipeline

	// Nếu có Category ID cụ thể (không phải random) thì thêm bước $match
	if categoryIDStr != "" && categoryIDStr != "random" {
		categoryID, err := primitive.ObjectIDFromHex(categoryIDStr)
		if err == nil {
			pipeline = append(pipeline, bson.D{{Key: "$match", Value: bson.D{{Key: "category_id", Value: categoryID}}}})
		}
	}

	// Bốc ngẫu nhiên số lượng câu hỏi
	pipeline = append(pipeline, bson.D{{Key: "$sample", Value: bson.D{{Key: "size", Value: limit}}}})

	cursor, err := db.CardCollection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var cards []models.Card
	if err := cursor.All(ctx, &cards); err != nil {
		return nil, err
	}
	return cards, nil
}
