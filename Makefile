ENV_FILE ?= .env.production
include $(ENV_FILE)
export

.PHONY: dev-backend dev-dotnet dev-client test-dotnet seed deploy deploy-production

dev-backend:
	cd backend && PORT="$(BACKEND_PORT)" go run ./cmd/server

dev-dotnet:
	cd backend-dotnet && PORT="$(BACKEND_PORT)" MONGO_URI="$(MONGO_URI)" DB_NAME="$(DB_NAME)" dotnet run --project src/VocabBattle.Api

dev-client:
	cd vocab-battle-client && NEXT_PUBLIC_API_URL="$(DEV_NEXT_PUBLIC_API_URL)" NEXT_PUBLIC_WS_URL="$(DEV_NEXT_PUBLIC_WS_URL)" pnpm exec next dev -p "$(CLIENT_INTERNAL_PORT)"

test-dotnet:
	cd backend-dotnet && dotnet test VocabBattle.slnx

seed:
	cd data && node seed.js

deploy:
	docker compose --env-file "$(ENV_FILE)" up -d --build --remove-orphans

deploy-production:
	$(MAKE) deploy ENV_FILE=.env.production
