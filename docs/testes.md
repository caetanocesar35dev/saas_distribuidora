# Testes manuais

Roteiro de testes manuais do sistema. Separado do [a_fazer.md](a_fazer.md) em 2026-10-30.

Logins do seed (`npm run db:seed` em `backend/`), todos com a senha `123456`:
`dono@exemplo.com`, `gerente@exemplo.com`, `funcionario@exemplo.com` e `admin@plataforma.com`.
Em desenvolvimento, os links de e-mail (redefinir senha, convite) aparecem no log do backend.

## 1. Cadastro e acesso

- [x] Criar conta em `/cadastro` com o CNPJ `05.648.257/0001-78`: razão social e nome fantasia
  devem ser preenchidos sozinhos.
- [x] Digitar um CNPJ com letras (ex.: `12.ABC.345/01DE-35`): é aceito, e aparece o aviso de que
  não foi encontrado.
- [x] Digitar um CNPJ inválido: aparece "CNPJ inválido.".
- [x] O celular é obrigatório no cadastro (com máscara e DDD). Depois de cadastrar com um CNPJ real,
  conferir em Lojas que a primeira loja veio com endereço e telefone, e no Início o quadro
  "Primeiros passos" (cada item marca sozinho; Esconder some com ele).
- [x] Digitar números ou símbolos no campo "Seu nome" (cadastro, Minha conta e convite de equipe):
  eles não entram no campo; colar "Maria 123" deixa só "Maria". Acentos, apóstrofo e hífen
  (ex.: João D'Ávila-Neto) passam.
- [x] Tentar criar a conta sem marcar "Li e aceito": deve ser recusado. Abrir os links dos
  termos e da política (abrem sem login, em `/termos` e `/privacidade`).
- [x] Entrar, sair, e usar "Sair de todos os aparelhos" em Minha conta.
- [x] Nos campos de senha (login, cadastro, redefinição e Minha conta), o olho mostra e esconde o
  que foi digitado.
- [x] Deixar a aba parada por mais de 15 minutos e continuar usando: não pode pedir login de novo.
- [x] "Esqueci a senha" com uma conta de e-mail real: o e-mail chega (confira também o spam),
  o botão abre a tela de nova senha e o link não funciona uma segunda vez.
- [x] Errar a senha 6 vezes seguidas: aparece a mensagem de muitas tentativas.

## 2. Dono (`dono@exemplo.com`)

- [x] Trocar de loja e de empresa pelo topo da tela.
- [x] Criar uma loja informando um CNPJ real: endereço e telefone devem ser preenchidos.
- [x] Em Nova loja, tentar salvar sem endereço: CEP, rua, número, bairro, cidade e UF são
  obrigatórios (complemento, telefone e CNPJ não).
- [x] Em Nova loja, conferir as máscaras (telefone, CEP, UF) e os limites: telefone sem DDD ou CEP
  com menos de 8 números é recusado; números na UF não entram.
- [ ] Convidar um funcionário (o link aparece no log do backend), mudar o papel dele por loja e
  revogar o acesso.
- [x] Com 2 lojas ou mais, em Convidar pessoa: "Todas as lojas" marca todas de uma vez (como
  atendente), o seletor ao lado põe o mesmo papel em todas, e desmarcar limpa a escolha. Um papel
  diferente numa loja faz o seletor mostrar "Papéis diferentes".
- [x] Editar os dados da empresa; o CNPJ deve estar bloqueado.
- [x] Ver o painel da empresa e o gráfico de 7 dias.
- [x] Excluir uma loja e, em Lojas, marcar "Mostrar as lojas excluídas": ela aparece com o endereço
  e a data. Reativar traz a loja de volta com as vendas e o estoque (se o plano estiver no limite
  de lojas, aparece o aviso do plano).
- [x] Em Assinatura › Planos: aparecem Essencial, Básico, Profissional e Rede (o Trial não). Com 2
  lojas, o Essencial fica apagado com o motivo. Fazer upgrade para o Básico: vale na hora e o
  cartão fica marcado "Seu plano". Voltar para um plano menor que caiba também funciona. Como
  gerente, os planos aparecem sem os botões.
- [x] Remover alguém da empresa e, em Equipe, marcar "Mostrar quem foi removido": aparecem a data e
  as lojas e papéis que a pessoa tinha. Reativar devolve os mesmos acessos.

## 3. PDV

- [x] Vender buscando o produto pelo nome e pelo leitor de código de barras, se houver um.
- [x] Usar os atalhos F2 (buscar) e F9 (finalizar).
- [x] Vender em lote: tocar em "+ fardo" no rodapé do cartão de um produto com fardo cadastrado, juntar
  unidades avulsas no carrinho (ex.: 2 fardos + 3 un.) e conferir o subtotal e, no detalhe da
  venda, "2 fardos de 12 + 3 un.". O estoque baixa em unidades. Na comanda, "+ fardo" lança o
  fardo inteiro.
- [x] Pagar em dinheiro e conferir o troco; dar desconto e tentar um desconto maior que o total.
- [x] Vender produto com vasilhame: na troca 1 por 1 não pede cliente; se o cliente sai devendo,
  exige cliente.
- [x] Compra do casco (com o preço do casco definido em Vasilhames › Tipos, ex.: Litrão R$ 8,00):
  vender 3 litrões, digitar 2 em "Compra o casco" e 1 em "Devolve": o total soma R$ 16,00 de cascos
  (o desconto não vale sobre eles) e nada fica devendo; com "todos" comprados, a venda sai sem
  cliente. No detalhe da venda aparecem "Cascos de vasilhame comprados" e o preço de cada um; o
  estoque de vasilhame da loja baixa 2. Cancelar a venda devolve os cascos ao estoque e o dinheiro.
- [x] Tipo de vasilhame sem preço do casco: o PDV mostra "Casco sem preço: só troca ou empréstimo".
- [x] Painel e Histórico de vendas: o faturamento e o lucro não contam os cascos; o cartão de
  Faturamento mostra "fora R$ ... em cascos de vasilhame vendidos". O caixa conta o dinheiro todo.
- [x] Fechar uma comanda com produto de vasilhame comprando o casco: funciona igual ao PDV.
- [x] Fiado para um cliente sem dívida: vende direto, sem aviso.
- [x] Fiado para um cliente que já deve: aparece o aviso com valor, número de vendas e data da
  mais antiga. "Não, voltar" não vende; "Sim, vender no fiado" vende.
- [x] Tentar vender com estoque insuficiente ("Estoque insuficiente").
- [x] Com o caixa fechado, vender: a venda sai e o caixa abre sozinho, com o saldo do último
  fechamento (o PDV só avisa, não bloqueia).

## 4. Caixa

- [x] Abrir o caixa à mão com outro saldo inicial, lançar entrada e sangria, e fechar conferindo
  o resumo por forma de pagamento.
- [x] Ver o histórico de caixas.
- [x] Como dono, em Lojas › Editar, mudar o "Fechamento automático do caixa" para daqui a poucos
  minutos e deixar o caixa aberto: até 5 minutos depois do horário ele fecha sozinho e aparece
  com a marca "automático" em Caixas anteriores.

## 5. Comandas

- [x] Abrir, lançar itens (o estoque baixa na hora), remover item e fechar no fiado (o aviso deve
  aparecer).
- [x] Cancelar uma comanda: o estoque volta.
- [ ] Lançar o mesmo produto duas vezes (ex.: Brahma latão): soma na mesma linha, com contador − / +.
  Mudar o contador muda o total e o estoque; passar do estoque avisa "Estoque insuficiente". Com
  fardo ("+ fardo"), aparecem um contador para o fardo e outro para as unidades.

## 6. Vendas

- [x] No PDV (e na comanda), sem pesquisar: aparecem os produtos da loja em ordem de nome, 24 por
  página, com Próxima e Anterior embaixo; um produto novo (ex.: "teste fardo") aparece na página
  dele. Pesquisar ou trocar a categoria volta para a página 1. Em "Mostrar ... por página", trocar
  para 12, 48 ou 96 (o padrão é 24) muda quantos aparecem; ao recarregar a página, a escolha continua.

- [x] Filtrar por período e forma de pagamento e abrir o detalhe.

- [x] No Início, vender no fiado: o cartão Faturamento mostra "R$ ... disso foi vendido no
  fiado"; receber um pagamento de fiado e ver o cartão "Fiado recebido".

- [x] Cancelar uma venda em dinheiro (sai do caixa) e uma fiada (sai da dívida).
- [x] Ver o histórico de alterações da venda.
- [x] Como gerente ou dono, no menu "Lançar venda antiga" (abaixo de Histórico de vendas), lançar uma venda de ontem: ela
  aparece no filtro de ontem com a marca "lançada depois", o estoque baixa e o dinheiro entra no
  caixa aberto agora (veja o resumo do caixa). Uma data no futuro é recusada.
- [x] Como atendente: o botão "Lançar venda antiga" não aparece e a URL mostra "sem permissão".

## 7. Clientes e fiado

- [x] Ver a lista com as colunas "Dívida nesta loja", "Outras lojas" e "Dívida total".
- [x] Marcar o filtro "Só quem deve no fiado".
- [x] Cadastrar um cliente com endereço: digitar um CEP real (ex.: 50030-230) e ver rua, bairro,
  cidade e UF preencherem sozinhos; completar número e complemento; conferir o endereço no
  detalhe do cliente. Cadastrar outro sem endereço (é opcional) e testar um CEP inexistente.

- [x] Receber um pagamento automático e um manual (escolhendo por loja).
- [x] Nos campos de dinheiro (receber fiado, PDV, produto): digitar "1234" mostra "1.234"; o "."
  do teclado numérico vira vírgula; ao sair do campo fica "1.234,00".


- [x] Pagar na Loja B a dívida da Loja A.


- [x] Tentar receber mais do que o cliente deve.


- [ ] Emprestar vasilhame; devolver na mesma loja (funciona) e em outra loja (recusado).
- [x] Tentar excluir um cliente que deve: deve ser recusado.
- [x] Como gerente ou dono, excluir um cliente sem dívida e marcar "Mostrar só os excluídos": ele
  aparece com telefone, endereço e data da exclusão; Reativar o traz de volta. Como atendente, a
  caixa "Mostrar só os excluídos" não aparece.
- [x] Como gerente ou dono, definir um limite de crédito no cliente (Editar) e ver o cartão
  "Limite de crédito" com o valor disponível.


- [x] Vender no fiado passando do limite: como atendente, aparece o pedido de autorização; o
  gerente digita o e-mail e a senha dele e a venda sai (senha errada é recusada, e o navegador não
  oferece salvar a senha). Gerente e dono veem o aviso e vendem em "Sim, vender acima do limite".
  No detalhe da venda aparece "Acima do limite, autorizado por" com o nome de quem autorizou.


- [x] Como atendente, abrir Editar do cliente: o campo de limite não aparece.

## 8. Estoque, produtos e vasilhames (gerente ou dono)

- [x] Dar entrada e ajuste de estoque e alterar preço.
- [x] Criar produto em várias lojas e tentar criar com um código repetido.
- [x] Excluir um produto e reativar em Produtos › "Mostrar só os excluídos" (volta com preço e
  estoque nas lojas).
- [x] Novo produto com "Preço de venda padrão": as lojas marcadas sem preço próprio usam ele.
- [x] Criar tipos de vasilhame e lançar movimentações com o fornecedor.
- [x] Vasilhames › Tipos › Editar: pôr, mudar e apagar o "Preço do casco" (vale para todas as lojas;
  a lista mostra "Casco: R$ ..." ou "Casco não é vendido"). Preço zero é recusado.
- [x] Preço do casco só de uma loja: em Vasilhames › aba Estoque › "Preço nesta loja", pôr R$ 9,50 no
  Litrão (empresa com R$ 8,00). A linha mostra "R$ 9,50 preço desta loja"; noutra loja continua
  "R$ 8,00 preço da empresa". No PDV desta loja, comprar o casco cobra R$ 9,50; na outra, R$ 8,00.
  Mudar o preço da empresa muda só as lojas sem preço próprio. "Usar o preço da empresa" volta ao
  da empresa. Atendente não vê o botão.
- [x] Produtos › Categorias: criar, renomear, tentar excluir uma com produto (recusa), excluir uma
  vazia e reativar em "Mostrar só as excluídas".
- [x] Filtrar por categoria e por "Sem categoria" em Produtos, Estoque, PDV e comanda.
- [x] Cigarro com embalagem "maço" de 20, maço a R$ 12,00 e custo do maço a R$ 9,50: com a unidade
  vazia, ela sai a R$ 0,60; com R$ 1,00, 1 maço + 3 cigarros dão R$ 15,00. O PDV mostra "+ maço (20)"
  com o preço e "Maços de 20" no carrinho, e a venda e a comanda mostram "1 maço de 20 + 3 un." e o
  mesmo total. O lucro confere nas duas formas. Sem nome, continua "fardo".
- [x] Produto com fardo e sem preço próprio (ex.: cerveja): continua unidade × quantidade.
- [x] Vender em duas categorias, com desconto: o painel mostra "Por categoria (este mês)".
- [x] Origem da venda: no PDV, ao finalizar, "Balcão" já vem marcado; vender uma pelo iFood e uma
  pelo WhatsApp. No Histórico de vendas aparecem na coluna Origem, e o filtro "Origem da venda" mostra
  só as de cada uma. O detalhe da venda mostra "Origem: iFood". Vendas de antes aparecem como "Sem
  origem".
- [x] Lançar venda antiga também pede a origem. Fechar comanda **não** pede: a venda vai como Balcão
  (mesmo que a padrão seja outra).
- [x] No Início (gerente ou dono) e no Painel da empresa: a tabela "Por origem (este mês)" mostra
  vendas, faturamento, a barra com a parte de cada origem, o valor médio por venda e o lucro vendido.
- [x] Como gerente ou dono, em Menu › Configurações › Origens da venda: adicionar "Aiqfome", renomear,
  tornar padrão (estrela; passa a vir marcada no PDV), tentar excluir a padrão (não tem lixeira),
  excluir outra e reativar em "Mostrar só as excluídas". Como atendente, o item Configurações não
  aparece no menu (e `/configuracoes` diz que não tem permissão).
- [x] Em Configurações, o quadro Categorias de produto faz o mesmo que Produtos › Categorias (é a
  mesma lista).
- [x] Entrar como atendente: o filtro aparece, mas sem custo nem lucro.

## 9. Permissões (entrar com cada papel) 

- [x] Atendente (`funcionario@exemplo.com`): não vê Produtos, custo, lucro, sangria, painel da
  empresa nem "Dívida total".
- [x] Logado como atendente, abrir no navegador `/api/stores/<id da loja>/sales`: a resposta
  não pode ter `costPrice`, `totalCost` nem `totalProfit`.
  
  
- [x] Gerente (`gerente@exemplo.com`): vê produtos e sangria, mas não a empresa.
- [x] Gerente geral: como dono, em Equipe, clicar em "Tornar gerente geral" no cartão do gerente. Ele
  ganha o selo "Gerente geral" e fica gerente em todas as lojas (o papel dele nas lojas fica travado).
- [x] Entrar como esse gerente: aparece "Painel da empresa" no menu; vê o painel, Lojas (Editar sim;
  Nova loja e Excluir não) e Equipe; não vê "Dados da empresa" nem "Mostrar quem foi removido".
- [ ] Como gerente geral, em Equipe: convidar um atendente e mudar o papel dele funcionam; a opção
  "Dono" não aparece; no cartão do dono não há botões.
- [x] Como dono, em Equipe, tentar mudar o papel ou tirar o acesso do gerente geral numa loja: não dá
  (o papel fica travado enquanto ele for gerente geral; é preciso "Tirar de gerente geral" antes).
- [x] Como gerente geral, abrir o histórico de alterações de um produto (Produtos › ícone de
  histórico) e o painel da empresa: os dois abrem. Um gerente comum não vê o painel da empresa.
- [x] Como dono, criar uma loja nova: o gerente geral já aparece nela como gerente. Depois, "Tirar de
  gerente geral": ele continua gerente nas lojas, mas perde o painel da empresa.


- [x] Digitar na URL uma página proibida para o papel: deve aparecer "sem permissão".

## 10. Assinatura e plataforma (`admin@plataforma.com`)

- [x] Em `/plataforma`, deixar a organização como "vencida" e entrar como dono: aparece a faixa de
  somente leitura, os botões ficam apagados e fechar o caixa continua liberado.

  --TODO TIVE QUE RECARREGAR A PAGINA
- [ ] Voltar a organização para "ativa": o acesso completo volta sozinho, sem recarregar a página.


- [x] Criar uma notificação e ver se ela aparece no sino.
- [ ] Com duas ou mais não lidas, clicar em "Marcar todas como lidas" no sino e, em outra vez, na
  tela Notificações: o contador do sino some, os avisos perdem a marca de não lido e o botão some.
  Sem nada não lido, o botão não aparece.
- [ ] Como `admin@plataforma.com`, criar uma notificação do tipo Enquete: sem 2 opções ou sem prazo o
  Salvar fica apagado; "Adicionar opção" vai até 10. Criar uma de escolha única e outra com "Permitir
  mais de uma resposta".
- [ ] Como atendente: no sino aparece "Votar até ..."; o link abre a enquete em Notificações. Antes de
  votar, nenhum número aparece; depois de votar, aparecem os votos e a porcentagem de cada opção e
  "Mudar voto". Na de várias respostas, marcar duas opções. Votar tira a notificação do contador.
- [ ] Como gerente (que não votou), abrir a mesma enquete: não vê os números até votar.
- [ ] Na plataforma, a lista mostra o resultado parcial sem quem votou; Editar mostra as opções
  travadas depois do primeiro voto, mas deixa mudar o prazo. Pôr o prazo no passado: a enquete fica
  "Votação encerrada" e todos veem o resultado, sem poder votar.
- [ ] Abrir uma organização: as lojas excluídas aparecem com a data, e a seção Pessoas mostra quem
  tem acesso, quem foi removido e as contas desativadas.
- [x] Em Planos, excluir um plano sem uso, marcar "Mostrar os planos excluídos" e Reativar.
- [ ] Conta isenta: numa organização de teste, Ajustar a assinatura › Situação "Isenta", Plano
  "Básico". Sem data e sem "Acesso vitalício" o Salvar fica apagado. Marcar vitalício, escrever o
  motivo e salvar: o resumo mostra "Isenta (vitalícia) · motivo". Entrar como o dono dela: em
  Assinatura aparece "Isenta (acesso vitalício)", o plano Básico e nenhum botão de troca de plano;
  vender funciona normalmente.
- [ ] Isenta com data limite daqui a 10 dias: o dono vê o aviso "Sua isenção termina em 10 dias".
  Pôr a data para amanhã e, no dia seguinte, o sistema fica somente para consulta com "A isenção de
  mensalidade terminou".
- [ ] Na página de apresentação (`/`), abaixo dos planos: "Prefere não pagar mensalidade?" com o
  botão do WhatsApp (mensagem sobre o pagamento único); e a pergunta "Dá para não pagar
  mensalidade?" no fim.

## 10a. Indicação e descontos

- [ ] Como dono (`dono@exemplo.com`), abrir Menu do usuário › Indique e ganhe: aparecem o código, o
  link e os botões Compartilhar no WhatsApp (abre o WhatsApp com a mensagem pronta), Copiar link e
  Copiar código. Como gerente, o item não aparece no menu.
- [ ] Abrir o link copiado numa janela anônima: o cadastro abre com o código já preenchido. Criar a
  conta (nova) com ele.
- [ ] Digitar um código que não existe no cadastro: aparece "Código de indicação não encontrado." e
  a conta não é criada.
- [ ] Na conta nova (a indicada), aparece o selo verde "-20%" ao lado do sino; clicando, mostra 2
  meses com 20% de desconto.
- [ ] De volta ao dono, em Indique e ganhe › Quem você indicou: a conta nova aparece como "Aguardando
  o 1º pagamento", e o dono ainda não ganhou desconto.
- [ ] Como `admin@plataforma.com`, em Organizações, abrir a conta nova (a seção Indicação mostra
  quem indicou) e pôr a Situação em Ativa. A indicação vira "Confirmada" e o dono ganha 2 meses
  (o selo aparece para ele).
- [ ] Em Plataforma › Representantes, cadastrar um representante (telefone, chave Pix, código
  próprio, comissão de 50%). Tentar repetir o código de um cliente ou de outro representante: é
  recusado.
- [ ] Criar uma conta com o código do representante, escolher (ou pôr pela plataforma) o plano
  Profissional e pôr em Ativa: em Plataforma › Indicações, a comissão aparece como R$ 174,50 a
  pagar. Clicar em Pix enviado: passa para "Pago em ..." e para Já pago no painel.
- [ ] Cancelar uma indicação (ícone de proibido, com motivo): os meses de desconto dela somem. Uma
  comissão já paga não pode ser cancelada.
- [ ] Conferir o painel de Indicações: totais, representantes, clientes que mais indicam e
  organizações com desconto a usar; filtros da lista (situação, origem, representante, comissão).
- [ ] Excluir o representante e tentar criar uma conta com o código dele: aparece "Código de
  indicação não encontrado." Depois, marcar "Mostrar os representantes excluídos", Reativar e criar
  a conta de novo com o mesmo código: agora é aceito.

## 10b. Página de apresentação e contato

- [x] Sem estar logado, abrir `/`: aparece a página de apresentação (não o login), com os planos do
  Essencial ao Rede, sem o Trial. "Testar grátis" abre o cadastro e "Entrar" abre o login.
- [x] Logado, abrir `/`: vai direto para o sistema.
- [x] Botões do WhatsApp: abrem a conversa com (31) 97562-3307 e a mensagem já escrita. Link do
  Instagram: abre @minhadistribuidoraonline_.
- [ ] Em Dúvidas: os dois canais aparecem no topo e no fim de cada artigo. Buscar "suporte" acha o
  artigo "Como falar com o suporte".
- [x] Abrir a página no celular: nada corta nem cria rolagem para o lado.
- [ ] Sem login, abrir `/robots.txt` (bloqueia `/loja/`, `/empresa/` etc. e aponta o sitemap) e
  `/sitemap.xml` (apresentação, cadastro, Dúvidas e cada artigo, termos, privacidade; nada da área
  logada nem os artigos da Plataforma).
- [ ] Mandar o link do site no WhatsApp: aparece a imagem com o nome e "Sistema para distribuidora
  de bebidas" (só funciona com o site no ar, num domínio público).
- [ ] Com o site no ar: colar o endereço no Teste de pesquisa aprimorada do Google
  (search.google.com/test/rich-results) e ver a organização, o sistema e as perguntas frequentes
  reconhecidos, sem erro.

## 11. Geral

- [x] Usar no celular e no tablet, principalmente o PDV.
- [x] Botão "?" de várias telas: cada um abre o artigo certo da Central de Dúvidas.
- [x] testar emails, especialmente de redefinir senha
- [ ] Rodar `npm run mail:test -- seu@email.com` em `backend/` e conferir os 7 e-mails no Gmail e no
  celular (boas-vindas, senha alterada e indicação confirmada são novos; o convite vem nas duas
  versões).
- [x] Criar uma conta com um e-mail real: chega o de boas-vindas com a data do fim do teste.
- [x] Trocar a senha em Minha conta: chega "Sua senha foi alterada".
- [x] Convidar uma pessoa com e-mail real em Equipe: chega o convite com o nome da empresa e de quem
  convidou, e o botão "Criar minha senha e acessar" abre a tela de criar senha.
- [ ] Convidar de novo a mesma pessoa antes de ela criar a senha (por exemplo, para outra loja): o
  segundo e-mail também traz "Criar minha senha e acessar", e o link funciona.
- [x] Convidar o e-mail de quem já usa o sistema (por exemplo, o dono de outra distribuidora): o
  e-mail diz que a pessoa já tem conta e o botão é "Entrar no sistema"; depois de entrar, a empresa
  nova aparece na lista de empresas.
- [ ] Lembretes da assinatura (a rotina roda todo dia às 9h, horário de Brasília): como
  `admin@plataforma.com`, numa organização em teste com e-mail real, pôr o fim do teste para daqui a
  3 dias e esperar as 9h do dia seguinte, ou conferir o texto pelo `mail:test`. Chega "Seu período
  de teste termina em 3 dias" (e, com 1 dia, o de amanhã).
- [ ] Indicação: com um e-mail real no dono que indicou, pôr o indicado em Ativa na plataforma: chega
  "Você ganhou 2 meses com 20% de desconto".
- [ ] notificacoes estao sendo recebidas por pooling ou socket?