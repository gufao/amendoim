<p align="center">
  <img src="src-tauri/icons/icon.png" width="128" height="128" alt="Amendoim" />
</p>

<h1 align="center">Amendoim</h1>

<p align="center">
  <strong>Um visualizador de banco de dados PostgreSQL gratuito, leve e bonito para macOS.</strong>
</p>

<p align="center">
  <a href="https://github.com/gufao/amendoim/releases/latest">Download</a> ·
  <a href="#funcionalidades">Funcionalidades</a> ·
  <a href="#desenvolvimento">Desenvolvimento</a>
</p>

---

## Por que Amendoim?

Ferramentas como TablePlus e Beekeeper Studio são ótimas, mas limitam funcionalidades na versão gratuita. Amendoim é **100% gratuito e open source** — sem limitações de conexões, sem trial, sem paywall.

O nome? O elefante do PostgreSQL adora amendoim.

## Funcionalidades

- **Schema Browser** — navegue schemas, tabelas e colunas em tree view com lazy loading
- **SQL Editor** — Monaco Editor com syntax highlighting, autocomplete e execução com `Cmd+Enter`
- **Tabela de Resultados** — ordenação, paginação, export CSV, visualizador de JSON/texto longo
- **Filtros Visuais** — filtre dados sem escrever SQL (WHERE clauses via dropdowns)
- **Preview de Tabela** — clique numa tabela e veja os dados + contagem total instantaneamente
- **Múltiplas Tabs** — abra várias queries ao mesmo tempo (`Cmd+N` / `Cmd+W`)
- **Senhas Seguras** — credenciais armazenadas no macOS Keychain, nunca em texto puro
- **Atualizações Automáticas** — OTA via GitHub Releases com assinatura criptográfica
- **Bilíngue** — interface em Português (pt-BR) e Inglês, alternável pelo status bar

## Stack

| Camada | Tecnologia |
|--------|-----------|
| App Shell | [Tauri v2](https://tauri.app/) (Rust) |
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| SQL Editor | Monaco Editor |
| DB Driver | sqlx (Rust, async) |
| State | Zustand |
| Tabela | TanStack Table v8 |

## Download

Baixe o `.dmg` mais recente na [página de releases](https://github.com/gufao/amendoim/releases/latest).

> Requer macOS 11 (Big Sur) ou superior.

### macOS: "app danificado" ou "não pode ser aberto"

O app ainda não possui assinatura Apple Developer. Após instalar, execute no terminal:

```bash
xattr -cr /Applications/Amendoim.app
```

Ou: clique com o botão direito no app > **Abrir** > **Abrir** novamente no diálogo que aparecer.

## Desenvolvimento

```bash
# Pré-requisitos: Node.js 18+, Rust
git clone https://github.com/gufao/amendoim.git
cd amendoim
npm install
npx tauri dev
```

### Banco de teste

Para testar localmente com dados de exemplo:

```bash
docker run --name amendoim-test -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
```

Conecte com: `localhost:5432`, user `postgres`, password `postgres`.

### Build

```bash
npx tauri build
```

O `.dmg` será gerado em `src-tauri/target/release/bundle/dmg/`.

## Atalhos

| Atalho | Ação |
|--------|------|
| `Cmd+Enter` | Executar query |
| `Cmd+N` | Nova tab |
| `Cmd+W` | Fechar tab |
| `Enter` (no filtro) | Aplicar filtros |

## Licença

MIT

---

<p align="center">
  <sub>Feito com Tauri, React e muito café.</sub>
</p>
