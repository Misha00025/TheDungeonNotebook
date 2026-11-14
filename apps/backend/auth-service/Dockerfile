FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["auth-service/auth-service.csproj", "auth-service/"]
COPY ["Tdn.Shared/Tdn.Shared.csproj", "Tdn.Shared/"]
RUN dotnet restore "auth-service/auth-service.csproj"
COPY auth-service/ auth-service/
COPY Tdn.Shared/ Tdn.Shared/
RUN dotnet build "auth-service/auth-service.csproj" --no-restore -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "auth-service/auth-service.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "auth-service.dll"]
