FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["users-service/users-service.csproj", "users-service/"]
COPY ["Tdn.Shared/Tdn.Shared.csproj", "Tdn.Shared/"]
RUN dotnet restore "users-service/users-service.csproj"
COPY users-service/ users-service/
COPY Tdn.Shared/ Tdn.Shared/
RUN dotnet build "users-service/users-service.csproj" --no-restore -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "users-service/users-service.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "users-service.dll"]
