@echo off
echo Starting local server for review...
echo.
echo Open your browser to: http://localhost:8080/index.html
echo Press Ctrl+C to stop the server.
echo.
start "" "http://localhost:8080/index.html"
python -m http.server 8080
pause
