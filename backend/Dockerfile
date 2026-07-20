FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY . .
RUN dotnet restore VocabBattle.slnx
RUN dotnet test VocabBattle.slnx --no-restore
RUN dotnet publish src/VocabBattle.Api/VocabBattle.Api.csproj -c Release --no-restore -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
EXPOSE 8080
ENTRYPOINT ["dotnet", "VocabBattle.Api.dll"]
