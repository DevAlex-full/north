# Publicação OTA do North App pelo celular

Este fluxo publica atualizações EAS Update sem depender de um computador local.

## Configuração única

No repositório `DevAlex-full/north`:

1. Abra **Settings**.
2. Acesse **Secrets and variables** → **Actions**.
3. Toque em **New repository secret**.
4. Crie o segredo:
   - Nome: `EXPO_TOKEN`
   - Valor: token pessoal criado na conta Expo.

Nunca salve o token em arquivo, commit, issue ou mensagem pública.

## Publicar pelo celular

1. Abra o repositório no GitHub.
2. Entre em **Actions**.
3. Selecione **Publicar North App OTA**.
4. Toque em **Run workflow**.
5. Escolha a branch EAS:
   - `preview`: aplicativo de testes atualmente instalado.
   - `production`: canal de produção, somente quando houver build compatível.
6. Informe uma mensagem para a atualização.
7. Confirme em **Run workflow**.

## O que o workflow executa

- instala as dependências com `npm ci`;
- autentica no EAS usando `EXPO_TOKEN`;
- executa `npx expo-doctor`;
- executa `npx tsc --noEmit`;
- valida o bundle Android;
- publica a OTA na branch selecionada.

Durante a execução, a API é fixada em:

```text
https://north-back.onrender.com/api/v1
```

Isso impede que uma URL local (`192.168.x.x`) seja incorporada acidentalmente na OTA.

## Após a publicação

1. Feche completamente o North App.
2. Abra o aplicativo conectado à internet.
3. Aguarde alguns segundos para o download da atualização.
4. Feche completamente o aplicativo novamente.
5. Abra e teste o login.

## Diagnóstico

Se o workflow falhar:

1. abra a execução em **Actions**;
2. toque no job **Validar e publicar OTA**;
3. abra a primeira etapa marcada em vermelho;
4. copie o erro completo para análise.

Se aparecer erro de autenticação do Expo, recrie ou substitua o segredo `EXPO_TOKEN`.
