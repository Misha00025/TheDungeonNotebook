FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["notes-service.csproj", "./"]
RUN dotnet restore "notes-service.csproj"
COPY . .
RUN dotnet build "notes-service.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "notes-service.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "notes-service.dll"]
