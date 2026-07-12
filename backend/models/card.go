package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Category struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"category_id"`
	Name        string             `bson:"name" json:"name"`
	Description string             `bson:"description" json:"description"`
	CreatedAt   time.Time          `bson:"created_at" json:"created_at"`
}


type BilingualText struct {
	En string `bson:"en" json:"en"`
	Vi string `bson:"vi" json:"vi"`
}

type Phonetic struct {
	Text   string `bson:"text" json:"text"`
	Audio  string `bson:"audio" json:"audio"`
	Locale string `bson:"locale" json:"locale"`
}


type Card struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"card_id"`
	Word        string             `bson:"word" json:"word"`
	Type        string             `bson:"type" json:"type"` 
	Explanation BilingualText      `bson:"explanation" json:"explanation"`
	Translation string             `bson:"translation" json:"translation"` 
	Example     BilingualText      `bson:"example" json:"example"`
	Phonetics   []Phonetic         `bson:"phonetics" json:"phonetics"`
	ImageURL    string             `bson:"image_url" json:"image_url"`
	Difficulty  string             `bson:"difficulty" json:"difficulty,omitempty"`
	CategoryID  primitive.ObjectID `bson:"category_id" json:"category_id"` 
}

type CardQuestion struct {
	CardID      string        `json:"card_id"`
	Type        string        `json:"type"`
	Explanation BilingualText `json:"explanation"`
	Phonetics   []Phonetic    `json:"phonetics"`
	ImageURL    string        `json:"image_url"`
	WordLength  int           `json:"word_length"`  
	HintPattern string        `json:"hint_pattern"`
}
