# Arquitetura do Amendoim

O **Amendoim** é um visualizador de banco de dados PostgreSQL gratuito, leve e de alta performance desenvolvido como uma aplicação desktop híbrida utilizando o **Tauri v2**. 

Este documento descreve a organização do projeto, o fluxo de dados e os principais conceitos arquiteturais da aplicação.

---

## 1. Visão Geral de Alto Nível

A arquitetura do Amendoim é dividida de forma clara em duas camadas principais:

```
┌────────────────────────────────────────────────────────┐
│               Camada de Interface (Frontend)          │
│                React 19 + Vite + Zustand               │
└──────────────────────────┬─────────────────────────────┘
                           │
                      Tauri IPC (via invoke)
                           │
┌──────────────────────────▼─────────────────────────────┐
│                 Camada Nativa (Backend)                │
│                 Tauri v2 Shell (Rust)                  │
└──────────────────────────┬─────────────────────────────┘
                           │
                 Native OS (macOS Keychain) & PostgreSQL
```

- **Frontend (Interface):** Uma Single Page Application (SPA) moderna feita em **React 19**, **TypeScript** e **Tailwind CSS v4**. Ele é empacotado e compilado usando **Vite**.
- **Backend (Nativo):** Um executável em **Rust** que gerencia o ciclo de vida do app, as conexões de banco de dados nativas de forma assíncrona (usando `sqlx`), interage com o chaveiro do macOS para senhas seguras e expõe comandos para o frontend através de **IPC (Inter-Process Communication)** do Tauri.

---

## 2. Estrutura do Repositório

O projeto segue a estrutura padrão de uma aplicação Tauri:

```
├── .github/                  # Workflows de CI/CD (GitHub Actions)
├── src/                      # Código Fonte do Frontend (React)
│   ├── assets/               # Imagens, fontes e recursos estáticos do frontend
│   ├── components/           # Componentes Visuais (Tabela, Editor, Sidebar, etc.)
│   ├── hooks/                # React Hooks customizados da aplicação
│   ├── i18n/                 # Arquivos de tradução (inglês/português)
│   ├── lib/                  # Serviços de API e pontes com Tauri (tauri.ts)
│   ├── stores/               # Gerenciamento de Estado com Zustand
│   ├── index.css             # Estilização global com Tailwind CSS v4
│   └── main.tsx              # Ponto de entrada do Frontend
├── src-tauri/                # Código Fonte do Backend (Rust)
│   ├── src/
│   │   ├── commands/         # Comandos expostos ao Frontend (conexão, queries, etc.)
│   │   ├── db/               # Gerenciador de pools e drivers PostgreSQL
│   │   ├── mcp/              # Integração com Model Context Protocol (MCP)
│   │   ├── models/           # Estruturas de dados compartilhadas e mapeamento
│   │   ├── keychain.rs       # Integração nativa com macOS Keychain para senhas
│   │   ├── lib.rs            # Definição e inicialização do módulo da aplicação
│   │   └── main.rs           # Inicializador do Tauri e registro de rotas
│   └── Cargo.toml            # Dependências nativas em Rust e configurações Tauri
├── package.json              # Scripts e metadados de dependências node
└── pnpm-workspace.yaml       # Configuração do pnpm (allowlist de scripts de build de deps nativas)
```

---

## 3. Comunicação IPC (Tauri Commands)

O Frontend e o Backend se comunicam exclusivamente via **Tauri commands**. O frontend invoca uma ação nativa em Rust e espera de forma assíncrona o resultado (promessa em JS/TS).

As chamadas são centralizadas em `src/lib/tauri.ts`. 

### Principais Comandos Implementados:

| Comando | Parâmetros | Retorno | Descrição |
|---------|------------|---------|-----------|
| `test_connection` | `config` | `Result<()>` | Testa credenciais informadas sem salvá-las |
| `save_connection` | `config` | `ConnectionConfig` | Salva a conexão e criptografa a senha no Keychain |
| `connect` | `id` | `Result<()>` | Estabelece pool de conexão para a base |
| `execute_query` | `sql, limit, offset` | `QueryResult` | Executa a query SQL de forma assíncrona |
| `list_schemas` | N/A | `SchemaInfo[]` | Lista schemas disponíveis no banco ativo |
| `list_tables` | `schema` | `TableInfo[]` | Lista tabelas de um schema via lazy-loading |
| `export_csv` | `sql, limit, offset` | `string` | Exporta o resultado de uma query para formato CSV |

---

## 4. Gerenciamento de Estado (Zustand)

O Amendoim utiliza o **Zustand** para o controle de estados globais de forma leve e direta, sem o boilerplate do Redux.

### Principais Stores:
1. **`useConnectionStore`** (`src/stores/connectionStore.ts`):
   - Gerencia a lista de conexões salvas.
   - Controla qual conexão está ativa e seu status de conexão no momento.
2. **`useQueryFileStore`** (`src/stores/queryFileStore.ts`):
   - Gerencia as abas/tabs de queries SQL abertas pelo usuário.
   - Utiliza lógica de nomeação monotônica (`max(existing_queries) + 1`) para criar novas queries sem sobrescrever ou duplicar identidades de queries deletadas.
   - Salva o estado atual das abas (queries escritas pelo usuário) no armazenamento local do navegador para persistência automática entre sessões.

---

## 5. Segurança de Credenciais

A segurança das senhas das conexões salvas é uma das maiores prioridades do projeto:

- ** macOS Keychain**: No macOS, as senhas dos bancos de dados são interceptadas pelo Backend Rust e armazenadas de forma nativa e encriptada no chaveiro do macOS utilizando APIs nativas do sistema.
- **Sem Texto Puro**: O arquivo de configuração de conexões gerado no disco rígido salva apenas os dados de host, porta e usuário. O campo de senha (`password`) é mantido em branco ou referenciado, sendo buscado de forma dinâmica do Keychain apenas no momento de abrir a conexão.
