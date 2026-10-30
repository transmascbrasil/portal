# Imagem pronta para rodar o painel com geração de JPG (Chromium incluso).
#   docker build -t post-studio .
#   docker run -p 3333:3333 -e PAINEL_SENHA=troque -v $(pwd)/empresas:/app/empresas post-studio
FROM mcr.microsoft.com/playwright:v1.48.2-jammy
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
ENV PORT=3333
EXPOSE 3333
CMD ["node", "server.mjs"]
