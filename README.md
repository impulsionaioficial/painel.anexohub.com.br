This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Fila de disparos personalizável

Cada campanha da aba **Fila de Disparos** possui o botão **Personalizar**. O editor permite:

- trocar título, mensagem, anexo, delay e modo de execução;
- adicionar ou remover instâncias da rotação;
- marcar individualmente quais contatos entram no disparo;
- remover contatos e reenviar uma falha ou um contato já processado;
- escolher, por categoria, quais erros pausam a fila e quais apenas são registrados.

Por padrão, instância/sessão desconectada e timeout pausam a campanha. Número inválido e bloqueio pelo destinatário não interrompem os demais contatos. Ao pausar, parar ou recarregar a página, contatos enviados permanecem concluídos e contatos ainda não processados podem ser retomados com **Continuar**.

As filas locais são preservadas durante a sessão da aba. Campanhas `camp_*` executadas no servidor são sincronizadas individualmente enquanto o processo Next.js permanece ativo; reinício do servidor ainda requer persistência externa antes de oferecer retomada entre processos.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
