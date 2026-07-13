include .env
export

.PHONY: dev-backend dev-client seed deploy

dev-backend:
	cd backend && PORT="$(BACKEND_PORT)" go run ./cmd/server

dev-client:
	cd vocab-battle-client && NEXT_PUBLIC_API_URL="$(DEV_NEXT_PUBLIC_API_URL)" NEXT_PUBLIC_WS_URL="$(DEV_NEXT_PUBLIC_WS_URL)" pnpm exec next dev -p "$(CLIENT_INTERNAL_PORT)"

seed:
	cd data && node seed.js

deploy:
	docker compose up -d --build --remove-orphans
