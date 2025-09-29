FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["uploads-service.csproj", "./"]
RUN dotnet restore "uploads-service.csproj"
COPY . .
RUN dotnet build "uploads-service.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "uploads-service.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "uploads-service.dll"]
