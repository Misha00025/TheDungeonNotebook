FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY bff-web.csproj ./
RUN dotnet restore bff-web.csproj
COPY Source/ ./Source/
COPY config/ ./config/
RUN dotnet publish bff-web.csproj --configuration Release --no-restore --output /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
COPY --from=build /app/publish/ ./
COPY entrypoint.sh /app/entrypoint.sh
COPY --from=build /src/config/appsettings.json /app/default-config/appsettings.json
EXPOSE 8080
ENTRYPOINT ["sh", "/app/entrypoint.sh"]
