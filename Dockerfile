# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container to /app
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

RUN npm install -g pnpm

# Install any needed packages specified in package.json
RUN pnpm install

# Bundle app source inside the docker image
COPY . .

# Make port 8080 available to the world outside this container
EXPOSE 80 3000

# Run the application when the container launches
CMD ["node", "src/index.js"]