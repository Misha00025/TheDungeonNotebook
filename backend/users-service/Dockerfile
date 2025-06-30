FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["users-service.csproj", "./"]
RUN dotnet restore "users-service.csproj"
COPY . .
RUN dotnet build "users-service.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "users-service.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "users-service.dll"]
