FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["campaign-service/backend-cs.csproj", "campaign-service/"]
COPY ["Tdn.Shared/Tdn.Shared.csproj", "Tdn.Shared/"]
RUN dotnet restore "campaign-service/backend-cs.csproj"
COPY campaign-service/ campaign-service/
COPY Tdn.Shared/ Tdn.Shared/
RUN dotnet build "campaign-service/backend-cs.csproj" --no-restore -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "campaign-service/backend-cs.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "backend-cs.dll"]
