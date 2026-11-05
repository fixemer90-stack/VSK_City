FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /repo
COPY src/backend/Vsk.Pitch.csproj src/backend/
RUN dotnet restore src/backend/Vsk.Pitch.csproj
COPY src/backend/ src/backend/
RUN dotnet publish src/backend/Vsk.Pitch.csproj -c Release -o /out --no-restore

FROM build AS test
COPY tests/backend/ tests/backend/
COPY data/demo/initial/ data/demo/initial/
RUN dotnet run --project tests/backend/Vsk.Pitch.Tests.csproj -c Release

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /out/ ./
COPY data/demo/initial/ /app/seed/
ENV ASPNETCORE_URLS=http://+:8080
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet","Vsk.Pitch.dll"]
