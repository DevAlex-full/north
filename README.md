# 🧭 North — App Mobile

Sistema pessoal de organização de rotina, finanças e produtividade.

## 📱 Stack

- **Framework:** React Native + Expo
- **Linguagem:** TypeScript
- **Navegação:** Expo Router (file-based)
- **Estado global:** Zustand
- **HTTP:** Axios
- **Storage:** AsyncStorage
- **Notificações:** Expo Notifications

---

## ⚙️ Pré-requisitos

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Android Studio ou dispositivo físico com Expo Go
- Backend North rodando (local ou Render)

---

## 🛠️ Instalação

```bash
# 1. Instale as dependências
npm install

# 2. Configure o ambiente
cp .env.example .env
# Edite o .env com a URL do seu backend

# 3. Inicie o app
npx expo start

# 4. Escaneie o QR code com o Expo Go (Android)
# Ou pressione 'a' para abrir no emulador Android
```

---

## 🌍 Variáveis de Ambiente

```env
# Desenvolvimento local
EXPO_PUBLIC_API_URL=http://SEU_IP_LOCAL:3000/api/v1

# Produção (Render)
EXPO_PUBLIC_API_URL=https://north-backend.onrender.com/api/v1
```

> ⚠️ No dispositivo físico, use o IP da sua máquina na rede local,
> não `localhost`. Ex: `http://192.168.1.100:3000/api/v1`

---

## 📲 Instalação Manual (APK)

Para instalar sem a Play Store:

```bash
# Instale o EAS CLI
npm install -g eas-cli

# Login no Expo
eas login

# Configure o projeto
eas build:configure

# Gere o APK (preview)
eas build --platform android --profile preview
```

Após o build, baixe o `.apk` e instale manualmente no Android.

---

## 🔐 Credenciais padrão (seed)

```
Email: alex@north.app
Senha: north2024
```

---

## 🗂️ Estrutura do Projeto

```
app/
├── _layout.tsx           # Layout raiz + guard de auth
├── (auth)/
│   ├── _layout.tsx
│   ├── login.tsx
│   └── register.tsx
├── (tabs)/
│   ├── _layout.tsx       # Barra de navegação inferior
│   ├── dashboard.tsx     # Tela inicial
│   ├── agenda.tsx        # Tarefas do dia
│   ├── financeiro.tsx    # Controle financeiro
│   ├── leads.tsx         # CRM de leads
│   └── mais.tsx          # Menu secundário
├── workana.tsx           # Propostas Workana
├── projetos.tsx          # Gerenciador de projetos
├── metas.tsx             # Metas 90 dias
├── empregos.tsx          # Vagas de emprego
├── conteudo.tsx          # Plano de conteúdo
└── configuracoes.tsx     # Configurações

components/ui/            # Componentes reutilizáveis
services/                 # Chamadas à API
stores/                   # Estado global (Zustand)
constants/                # Tema e design tokens
utils/                    # Formatação, datas, storage
hooks/                    # Custom hooks
```

---

## 📡 Telas disponíveis

| Tela | Descrição |
|------|-----------|
| Login / Cadastro | Autenticação |
| Dashboard | Visão geral do dia |
| Agenda | Tarefas com checklist |
| Financeiro | Entradas, saídas, meta Indrive |
| Leads | CRM de prospecção |
| Workana | Controle de propostas |
| Projetos | BarberFlow, LocaMed... |
| Metas | Objetivos 90 dias |
| Empregos | Vagas acompanhadas |
| Conteúdo | Plano editorial |
| Configurações | Perfil, metas, notificações |

---

## 🎨 Design

- Tema escuro por padrão
- Paleta: Indigo + Slate
- Botões grandes (uso com uma mão)
- Checkboxes visíveis
- Cores de status intuitivas
- Mínimo de informação por tela

---

## 🔧 Comandos úteis

```bash
# Iniciar desenvolvimento
npx expo start

# Limpar cache
npx expo start --clear

# Build Android (preview APK)
eas build --platform android --profile preview

# Ver logs do dispositivo
npx expo start --no-bundler && adb logcat
```
