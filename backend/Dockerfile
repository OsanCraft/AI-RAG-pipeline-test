FROM python:3.13-slim

WORKDIR /app

# Install dependencies first (separate layer) so Docker can cache this step -
# rebuilding only re-runs pip install if requirements.txt actually changes,
# instead of every single time any source file changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Now copy the actual application code
COPY . .

EXPOSE 5050

CMD ["python", "server.py"]
