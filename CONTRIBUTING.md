# Como Contribuir para o Amendoim

Primeiramente, muito obrigado pelo interesse em contribuir com o **Amendoim**! 🎉 É a ajuda de pessoas como você que torna esta ferramenta um visualizador de banco de dados fantástico e acessível para todos.

Este documento serve como guia sobre como propor melhorias, reportar bugs, configurar o ambiente de desenvolvimento local e submeter suas alterações de código.

---

## 1. Reportando Bugs ou Sugerindo Funcionalidades

Se você encontrou um bug ou tem uma ideia fantástica de nova funcionalidade:
1. Verifique se já não existe uma **Issue** ou **Pull Request** aberta tratando do mesmo assunto nas abas do repositório no GitHub.
2. Caso não exista, abra uma nova **Issue** detalhando o problema ou sugestão.
3. Se for um bug, inclua:
   - Passos claros para reproduzir o problema.
   - O comportamento esperado versus o comportamento observado.
   - Erros mostrados no console (Frontend) ou logs de terminal (Backend).
   - Versão do macOS e do banco de dados PostgreSQL sendo utilizado.

---

## 2. Configurando o Ambiente de Desenvolvimento

Para começar a alterar o código localmente, você precisará configurar o seguinte ambiente:

### Pré-requisitos
- **Node.js 18** ou superior.
- **pnpm** (gerenciador de pacotes padrão deste projeto).
- **Rust** (instalado via `rustup`).
- **Xcode Command Line Tools** (necessário para compilação nativa no macOS).

### Passo a Passo

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/gufao/amendoim.git
   cd amendoim
   ```

2. **Instale as dependências:**
   ```bash
   pnpm install
   ```

3. **Inicie o servidor de desenvolvimento:**
   ```bash
   pnpm tauri dev
   ```
   *Este comando compilará o backend Rust e o frontend React, abrindo o app localmente com suporte a Hot Reloading para qualquer modificação que você fizer.*

---

## 3. Rodando o Banco de Dados de Testes

Para testar suas alterações de forma prática sem interferir em bancos de produção, nós disponibilizamos um contêiner Docker oficial configurado para testes locais.

Para iniciar o banco de dados de teste:
```bash
docker run --name amendoim-test -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
```

Conecte no app utilizando:
- **Host**: `localhost`
- **Porta**: `5432`
- **Usuário**: `postgres`
- **Senha**: `postgres`

---

## 4. Práticas de Código e Padrões

Para mantermos a qualidade e a consistência do código, solicitamos que você siga estes padrões básicos:

### Frontend (React & TypeScript)
- **Componentes Funcionais**: Sempre utilize componentes funcionais com hooks.
- **TypeScript Estrito**: Evite o uso de `any`. Sempre tipifique propriedades, parâmetros de funções e retornos.
- **CSS Utility-First**: Utilizamos o **Tailwind CSS v4** para toda a estilização do projeto.
- **Zustand Actions**: Mantenha a lógica de atualização de estado encapsulada dentro das ações das respectivas stores (ex: `src/stores/`).

### Backend (Rust)
- **Clippy**: Execute `cargo clippy` no diretório `src-tauri` para verificar se existem avisos ou melhorias no código Rust.
- **Cargo Fmt**: Formate o seu código nativo antes de realizar commits executando `cargo fmt`.

---

## 5. Executando e Escrevendo Testes

Nós utilizamos o **Vitest** como framework de testes para a lógica da aplicação (Zustand, funções auxiliares, filtros, etc.).

### Como Executar os Testes Atuais:
```bash
pnpm test
```

### Escrevendo Novos Testes:
- Se você corrigir um bug ou implementar uma funcionalidade que altere regras de negócio ou comportamento de estado, **sempre inclua testes unitários**.
- Os arquivos de teste devem seguir a nomenclatura `*.test.ts` e ser colocados junto do arquivo de código que estão testando (ex: `src/stores/queryFileStore.test.ts`).

---

## 6. Fluxo de Git & Pull Requests

Para enviar suas alterações:

1. **Crie uma branch descritiva** a partir da branch `main`:
   ```bash
   git checkout -b minha-melhoria
   ```
   *Exemplos de nomes:* `feat/suporte-mcp`, `fix/query-counter`, `docs/readme-updates`.

2. **Escreva mensagens de commit claras e curtas**:
   - Preferencialmente use o formato convencional, ex: `fix: corrige ordenação de tabela vazia`, `feat: adiciona botão de duplicar query`.

3. **Suba a branch e abra a Pull Request**:
   - Faça o push para o seu fork ou para o repositório original.
   - Abra a Pull Request detalhando quais alterações foram propostas e quais bugs foram resolvidos.
   - Aguarde a execução dos testes automatizados de CI e a revisão da equipe!
