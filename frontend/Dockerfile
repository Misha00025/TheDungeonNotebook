# Specify the base image with Node.js installed via nvm
FROM node:20 as builder

# Create app directory
WORKDIR /usr/src/app

RUN apt install curl bash

# Install nvm and set Node.js version to v20.x
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash \
	&& . ~/.nvm/nvm.sh \
	&& nvm install 20 \
	&& nvm alias default 20 \
	&& nvm use 20

# Copy package.json and lock file (if any)
COPY package*.json ./

# Install dependencies
RUN npm ci

# Bundle app source
COPY . .

# Build static files
RUN npm run build

# Final stage
FROM node:lts-alpine

# Set working directory
WORKDIR /app

# Copy built files from previous stage
COPY --from=builder /usr/src/app/build ./build

# Install serve globally
RUN npm install -g serve

# Start the server on port 3000
CMD ["serve", "-s", "build", "-l", "3000"]
