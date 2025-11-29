# Docker Installation Guide

This guide will help you install and run the SAS4 License Search Server using Docker.

## Prerequisites

- Docker installed on your system
  - [Install Docker Desktop](https://www.docker.com/products/docker-desktop) (Windows/Mac)
  - [Install Docker Engine](https://docs.docker.com/engine/install/) (Linux)

## Quick Start

### 1. Build the Docker Image

Navigate to the project directory and build the Docker image:

```bash
docker build -t sas4-license-server .
```

### 2. Run the Container

Run the container in detached mode:

```bash
docker run -d -p 3000:3000 --name sas4-license-server sas4-license-server
```

The server will be available at `http://localhost:3000`

## Configuration

### Environment Variables

You can customize the port using environment variables:

```bash
docker run -d -p 8080:3000 -e PORT=3000 --name sas4-license-server sas4-license-server
```

### Port Mapping

- **Host Port**: The port on your machine (e.g., `8080`)
- **Container Port**: The port inside the container (default: `3000`)

Format: `-p <host-port>:<container-port>`

## Usage Examples

### Start the Container

```bash
docker start sas4-license-server
```

### Stop the Container

```bash
docker stop sas4-license-server
```

### View Logs

```bash
docker logs sas4-license-server
```

### Follow Logs (Real-time)

```bash
docker logs -f sas4-license-server
```

### Remove the Container

```bash
docker stop sas4-license-server
docker rm sas4-license-server
```

### Remove the Image

```bash
docker rmi sas4-license-server
```

## Testing the API

### Health Check

```bash
curl http://localhost:3000/health
```

### Search License by Keyword

```bash
curl -X POST http://localhost:3000/api/search-license \
  -H "Content-Type: application/json" \
  -d '{"keyword": "123"}'
```

### Search by EHWID

```bash
curl -X POST http://localhost:3000/api/search-license \
  -H "Content-Type: application/json" \
  -d '{"keyword": "Q46I5-BEAAO-RQA4R-EBQDT"}'
```

### Search by Email

```bash
curl -X POST http://localhost:3000/api/search-license \
  -H "Content-Type: application/json" \
  -d '{"keyword": "user@example.com"}'
```

## Docker Compose (Optional)

Create a `docker-compose.yml` file for easier management:

```yaml
version: '3.8'

services:
  sas4-license-server:
    build: .
    container_name: sas4-license-server
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
    restart: unless-stopped
```

Then run:

```bash
docker-compose up -d
```

To stop:

```bash
docker-compose down
```

## Troubleshooting

### Check Container Status

```bash
docker ps -a
```

### Inspect Container

```bash
docker inspect sas4-license-server
```

### Execute Commands Inside Container

```bash
docker exec -it sas4-license-server sh
```

### View Container Resource Usage

```bash
docker stats sas4-license-server
```

### Common Issues

1. **Port Already in Use**
   - Change the host port: `-p 8080:3000`
   - Or stop the service using port 3000

2. **Container Won't Start**
   - Check logs: `docker logs sas4-license-server`
   - Verify the image was built correctly: `docker images`

3. **Cannot Connect to API**
   - Ensure the container is running: `docker ps`
   - Check port mapping: `docker port sas4-license-server`
   - Verify firewall settings

## Production Deployment

### Build for Production

```bash
docker build -t sas4-license-server:latest .
```

### Run with Restart Policy

```bash
docker run -d \
  -p 3000:3000 \
  --name sas4-license-server \
  --restart unless-stopped \
  sas4-license-server:latest
```

### Using Docker Swarm or Kubernetes

The container can be deployed to Docker Swarm or Kubernetes clusters. Ensure:
- Port 3000 is exposed
- Health check endpoint `/health` is configured
- Proper resource limits are set

## API Endpoints

- **Health Check**: `GET /health`
- **Search License**: `POST /api/search-license`
  - Body: `{ "keyword": "search_term" }`
  - Keyword can be: License ID, Email, or EHWID (Hardware ID)

## Support

For issues or questions, please check the main README.md file or contact the development team.

