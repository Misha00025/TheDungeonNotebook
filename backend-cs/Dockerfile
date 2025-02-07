FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["backend-cs.csproj", "./"]
RUN dotnet restore "backend-cs.csproj"
COPY . .
RUN dotnet build "backend-cs.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "backend-cs.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "backend-cs.dll"]
