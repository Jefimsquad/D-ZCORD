# 🚀 DÉZCORD

> Aplicativo de comunicação em tempo real moderno, responsivo e inspirado no Discord. Conectado ao **Supabase** (PostgreSQL + Realtime) e preparado para versionamento no **GitHub**.

---

## 🎮 Funcionalidades Principais

- **Interface Fiel ao Discord**:
  - Paleta de cores oficial (Dark theme, Blurple `#5865F2`, status `#23A55A`).
  - Barra lateral de Servidores com botões dinâmicos, indicador pill e modal de criação de servidores.
  - Barra lateral de Canais com canais de texto (`#`) e canais de voz (`🔊`).
  - Painel inferior de status de usuário com controle de Microfone, Fone de Ouvido e Configurações.
  - Barra lateral de membros online/offline agrupados por cargos e funções.
  - Aba de Amigos / Mensagens Diretas (Disponível, Todos, Adicionar Amigo).

- **Chat em Tempo Real**:
  - Mensagens com suporte a Markdown (negrito, blocos de código, inline code).
  - Envio de imagens e anexos.
  - Reações com emojis interativas e contadores.
  - Respostas a mensagens e remoção.

- **Canais de Voz e Chamadas**:
  - Detecção de fala em tempo real via Web Audio API com anel verde pulsante (`speaking-ring`).
  - Suporte a ligar/desligar câmera e compartilhamento de tela nativo do navegador.
  - Indicador de latência e controle de desconexão instantânea.

- **Painel de Configurações**:
  - **Minha Conta**: Edição de perfil, banner, nome e status.
  - **Supabase**: Teste e conexão direta via interface com feedback visual.
  - **GitHub**: Comandos prontos para conectar ao repositório remoto.
  - **Voz e Vídeo**: Medidor de decibéis do microfone em tempo real.

---

## ⚡ Integração com o Supabase

1. Crie um projeto gratuito em [supabase.com](https://supabase.com).
2. No painel do seu projeto Supabase, acesse o **SQL Editor**.
3. Copie o conteúdo do arquivo [`supabase/schema.sql`](./supabase/schema.sql) e execute.
4. No **DÉZCORD**, clique no ícone do banco de dados na barra lateral esquerda (ou acesse as Configurações de Usuário) e insira sua `Project URL` e `Project Anon Key`.
5. Pronto! Mensagens e canais serão sincronizados via Realtime.

---

## 🐙 Integração com o GitHub

Para subir o projeto ao seu repositório do GitHub:

```bash
# 1. Crie um repositório no GitHub chamado 'dezcord'
# 2. Conecte o repositório remoto:
git remote add origin https://github.com/SEU-USUARIO/dezcord.git

# 3. Envie para o GitHub:
git branch -M main
git push -u origin main
```

---

## 🛠️ Executando Localmente

```bash
# Instalar dependências (caso necessário)
npm install

# Iniciar o servidor de desenvolvimento
npm run dev
```
