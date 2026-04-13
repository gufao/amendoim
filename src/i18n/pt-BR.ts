export const ptBR = {
  // App
  "app.welcome": "Bem-vindo ao Amendoim",
  "app.welcome.description": "Conecte-se a um banco de dados PostgreSQL para começar a explorar seus dados.",
  "app.welcome.newConnection": "Nova Conexão",
  "app.welcome.hint": "Ou selecione uma conexão salva na barra lateral",

  // Sidebar
  "sidebar.expand": "Expandir barra lateral",
  "sidebar.collapse": "Recolher barra lateral",
  "sidebar.explorer": "Explorador",
  "sidebar.connections": "Conexões",
  "sidebar.newConnection": "Nova Conexão",

  // Connection
  "connection.new": "Nova Conexão",
  "connection.edit": "Editar Conexão",
  "connection.postgresql": "PostgreSQL",
  "connection.name": "Nome",
  "connection.name.placeholder": "Meu Banco de Dados",
  "connection.host": "Host",
  "connection.port": "Porta",
  "connection.user": "Usuário",
  "connection.password": "Senha",
  "connection.database": "Banco de Dados",
  "connection.test": "Testar Conexão",
  "connection.save": "Salvar e Conectar",
  "connection.update": "Atualizar",
  "connection.add": "Adicionar Conexão",
  "connection.connect": "Conectar",
  "connection.disconnect": "Desconectar",
  "connection.delete": "Excluir",
  "connection.nameRequired": "O nome da conexão é obrigatório",
  "connection.success": "Conexão bem-sucedida!",
  "connection.disconnected": "Desconectado",

  // Schema
  "schema.noSchemas": "Nenhum schema encontrado",
  "schema.browser": "Schema",

  // Table Info
  "tableInfo.column": "Coluna",
  "tableInfo.type": "Tipo",
  "tableInfo.nullable": "Nulo",
  "tableInfo.default": "Padrão",
  "tableInfo.yes": "SIM",
  "tableInfo.no": "NÃO",
  "tableInfo.indexes": "Índices",
  "tableInfo.unique": "único",

  // Top Bar
  "topBar.newQuery": "Nova Query (Cmd+N)",
  "topBar.run": "Executar",
  "topBar.stop": "Parar",
  "topBar.cancelQuery": "Cancelar Query (Cmd+Enter)",
  "topBar.executeQuery": "Executar Query (Cmd+Enter)",

  // Editor
  "editor.empty": "Abra uma nova aba de query para começar",
  "editor.executeQuery": "Executar Query",

  // Results
  "results.executing": "Executando query...",
  "results.error": "Erro na Query",
  "results.empty": "Os resultados aparecerão aqui",
  "results.noRows": "A query não retornou linhas",
  "results.rowsAffected": "{count} linhas afetadas",
  "results.exportCsv": "Exportar CSV",
  "results.rows": "Linhas:",
  "results.null": "NULO",

  // Status Bar
  "status.rows": "{count} linhas",
  "status.rowsOfTotal": "{count} linhas de {total} total",
  "status.affected": "{count} afetadas",

  // Filter Bar
  "filter.where": "ONDE",
  "filter.and": "E",
  "filter.value": "valor...",
  "filter.disable": "Desativar filtro",
  "filter.enable": "Ativar filtro",
  "filter.on": "ON",
  "filter.off": "OFF",
  "filter.add": "Adicionar filtro",
  "filter.apply": "Aplicar",
  "filter.previewSql": "Ver SQL",
  "filter.copiedSql": "Copiado!",

  // Filter operators
  "filter.op.equals": "igual",
  "filter.op.notEquals": "diferente",
  "filter.op.greaterThan": "maior que",
  "filter.op.greaterOrEqual": "maior ou igual",
  "filter.op.lessThan": "menor que",
  "filter.op.lessOrEqual": "menor ou igual",
  "filter.op.contains": "contém",
  "filter.op.notContains": "não contém",
  "filter.op.isNull": "é nulo",
  "filter.op.isNotNull": "não é nulo",

  // Cell Viewer
  "cellViewer.column": "Coluna:",
  "cellViewer.copy": "Copiar",

  // Editing
  "edit.save": "Salvar",
  "edit.saving": "Salvando...",
  "edit.discard": "Descartar",
  "edit.pendingChanges": "{count} alteracao(oes)",
  "edit.noPrimaryKey": "Impossivel editar: tabela sem chave primaria",
  "edit.saveError": "Erro ao salvar",

  // Updates
  "update.available": "Atualização disponível",
  "update.install": "Instalar e reiniciar",
  "update.installing": "Instalando...",

  // MCP
  "mcp.title": "Assistente IA (MCP)",
  "mcp.subtitle": "Conecte ferramentas de IA ao seu banco",
  "mcp.description": "Conecte assistentes de IA ao schema do seu banco de dados. A IA pode ler a estrutura das tabelas mas NÃO os seus dados. As consultas geradas aparecem no Amendoim para você visualizar.",
  "mcp.serverRunning": "Servidor ativo",
  "mcp.serverStopped": "Servidor parado",
  "mcp.start": "Iniciar",
  "mcp.stop": "Parar",
  "mcp.setupTitle": "Configurar no seu cliente de IA:",
  "mcp.copy": "Copiar",
  "mcp.copied": "Copiado!",
  "mcp.install": "Instalar",
  "mcp.privacyTitle": "Privacidade:",
  "mcp.privacyNote": "A IA acessa apenas metadados (nomes de tabelas, colunas, tipos). Os dados das consultas são exibidos somente na tela do Amendoim — a IA nunca vê os resultados.",
  "mcp.statusBar": "IA",

  // Sidebar Queries
  "sidebar.queries": "Queries",
  "sidebar.newQuery": "+ Nova Query",

  // Filter: Any Column
  "filter.anyColumn": "Qualquer coluna",
  "filter.columns": "Colunas",

  // Row Detail
  "rowDetail.title": "Linha #{row}",
  "rowDetail.copied": "Copiado",
  "rowDetail.close": "Fechar detalhe",

  // Editor (new keys for embedded Run/Stop)
  "editor.run": "Executar",
  "editor.stop": "Parar",

  // Query files
  "query.untitled": "SQL Query {n}",
  "query.delete": "Excluir query",
  "query.rename": "Renomear",
  "query.deleteConfirm": "Tem certeza que deseja excluir esta query?",
} as const;

export type TranslationKey = keyof typeof ptBR;
