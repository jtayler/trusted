# Use an official Node runtime as a parent image
FROM node:18.14.2

# Set the working directory to /app
WORKDIR /app

# Copy the Node app's files into the container
COPY package*.json ./
COPY . .

# Install Node app's dependencies
RUN npm install --no-cache

# Install sqlite3 module
RUN npm install sqlite3
RUN npm rebuild --build-from-source --sqlite=/usr/local

# Rebuild the bcrypt module
RUN npm rebuild bcrypt --build-from-source

# Set the environment variable
ENV PRIVATE_KEY=z24acdhznmlocpop4embib4fj3hrkeaqv3oadt3dykuvln4ghqka

# Expose the port your Node app listens on
EXPOSE 3000

# Start the Node app
CMD ["node", "app.js"]
