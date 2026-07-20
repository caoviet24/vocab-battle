ENV_FILE ?= $(if $(filter deploy,$(MAKECMDGOALS)),.env.product,.env.local)
include $(ENV_FILE)
export

.PHONY: dev-backend dev-client test seed deploy

dev-backend:
	cd backend && PORT="$(BACKEND_PORT)" dotnet run --project src/VocabBattle.Api

dev-client:
	cd client && NEXT_PUBLIC_API_URL="$(DEV_NEXT_PUBLIC_API_URL)" NEXT_PUBLIC_WS_URL="$(DEV_NEXT_PUBLIC_WS_URL)" pnpm exec next dev -p "$(CLIENT_INTERNAL_PORT)"

test:
	cd backend && dotnet test VocabBattle.slnx

seed:
	cd data && node seed.js

deploy:
	docker compose --env-file "$(ENV_FILE)" up -d --build --remove-orphans
