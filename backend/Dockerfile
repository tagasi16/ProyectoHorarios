FROM node:18-alpine

# Directorio de trabajo
WORKDIR /app

# Instalar dependencias primero (cache layer)
COPY package*.json ./
RUN npm install --production

# Copiar código fuente del backend
COPY . .

# Exponer el puerto
EXPOSE 3000

# Healthcheck para saber cuando el servidor está listo
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

# Comando de inicio
CMD ["node", "server.js"]