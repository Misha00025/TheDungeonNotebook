FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["game-systems-service/game-systems-service.csproj", "game-systems-service/"]
COPY ["Tdn.Shared/Tdn.Shared.csproj", "Tdn.Shared/"]
RUN dotnet restore "game-systems-service/game-systems-service.csproj"
COPY game-systems-service/ game-systems-service/
COPY Tdn.Shared/ Tdn.Shared/
RUN dotnet build "game-systems-service/game-systems-service.csproj" --no-restore -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "game-systems-service/game-systems-service.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "game-systems-service.dll"]
