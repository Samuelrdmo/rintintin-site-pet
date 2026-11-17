# Rin Tin Tin Pet: site com agendamento

Site em React + Vite com agendamento online. Os dados ficam numa **Planilha Google**, com o **Google Apps Script** fazendo o papel de API (custo zero).

| Página | O que faz |
|---|---|
| `/` | Página da marca com os serviços |
| `/agendar` | Cliente escolhe o serviço, o dia e o horário (só vê os horários livres) e preenche os dados |
| `/meu-agendamento` | Mostra o último agendamento salvo no aparelho, ou recupera pelo **WhatsApp + nome do pet** |
| `/admin` | Login da dona: lista os agendamentos, filtra por período e muda o status |

Sem `VITE_API_URL`, o site roda em **modo demonstração**: tudo fica no navegador e o login é `demo` / `demo1234`. Use esse modo para apresentar ao cliente.

## Rodar no computador

```bash
npm install
npm run dev
```

## Ligar na planilha (versão de verdade)

1. Na conta Google **da dona**, crie uma planilha nova.
2. Abra **Extensões → Apps Script**, apague o conteúdo e cole o arquivo `apps-script/Code.gs`.
3. No topo, selecione a função **`configurarPlanilha`**, clique em **Executar** e autorize. Isso cria as abas Agendamentos, Servicos, Config, Admins e Sessoes.
4. Na função **`criarAdmin`**, troque `USUARIO`, `NOME` e `SENHA`, execute e depois **apague a senha do código**. A planilha guarda só o hash, nunca a senha.
5. Clique em **Implantar → Nova implantação → App da Web**:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
6. Copie a URL que termina em `/exec`.
7. Na hospedagem, crie a variável de ambiente `VITE_API_URL` com essa URL e faça um novo deploy.

> Sempre que mudar o `Code.gs`, vá em **Implantar → Gerenciar implantações → editar → Nova versão**. Assim a URL continua a mesma.

### O que a dona edita direto na planilha

- **Servicos**: nome, descrição, preço e se o serviço aparece no site (coluna Ativo = Sim/Não).
- **Config**: horário de abertura e fechamento, intervalo, vagas por horário, dias fechados, e-mail que recebe aviso, WhatsApp, endereço e Instagram.
- **Agendamentos**: dá para ver e editar tudo, mas o mais prático é pelo `/admin`.

## Segurança

- A planilha **não é pública**. Só o script acessa os dados.
- A senha é salva com salt + SHA-256 (2000 rodadas). Login bloqueia depois de 5 tentativas erradas por 15 minutos.
- A sessão do admin expira em 12 horas.
- A busca do cliente exige telefone **e** nome do pet, e devolve só data, hora, serviço e status.
- `LockService` impede duas pessoas de pegarem a última vaga do mesmo horário.

## Hospedagem

O plano grátis do Vercel (Hobby) aceita repositório privado, mas é só para **uso não comercial**. Para site de cliente, use o **Cloudflare Pages**, que é grátis e permite uso comercial:

- **Cloudflare Pages**: Workers & Pages → Create → Pages → conectar o GitHub → Framework *Vite* → build `npm run build` → saída `dist` → variável `VITE_API_URL`. O arquivo `public/_redirects` já cuida das rotas.
- **Vercel**: importar o repositório. O `vercel.json` já cuida das rotas.

## Estrutura

```
apps-script/Code.gs      API da planilha (colar no Apps Script)
src/lib/api.js           chamadas à API + modo demonstração
src/lib/util.js          datas, máscara de telefone, cache do agendamento
src/components.jsx       layout, ticket do agendamento
src/pages/               Home, Agendar, MeuAgendamento, Admin
src/styles.css           design system (cores, fontes, componentes)
```
