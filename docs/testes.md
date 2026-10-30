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
- [ ] Deixar a aba parada por mais de 15 minutos e continuar usando: não pode pedir login de novo.
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
- [x] Editar os dados da empresa; o CNPJ deve estar bloqueado.
- [x] Ver o painel da empresa e o gráfico de 7 dias.
- [ ] Excluir uma loja e, em Lojas, marcar "Mostrar as lojas excluídas": ela aparece com o endereço
  e a data. Reativar traz a loja de volta com as vendas e o estoque (se o plano estiver no limite
  de lojas, aparece o aviso do plano).
- [x] Em Assinatura › Planos: aparecem Essencial, Básico, Profissional e Rede (o Trial não). Com 2
  lojas, o Essencial fica apagado com o motivo. Fazer upgrade para o Básico: vale na hora e o
  cartão fica marcado "Seu plano". Voltar para um plano menor que caiba também funciona. Como
  gerente, os planos aparecem sem os botões.
- [ ] Remover alguém da empresa e, em Equipe, marcar "Mostrar quem foi removido": aparecem a data e
  as lojas e papéis que a pessoa tinha. Reativar devolve os mesmos acessos.

## 3. PDV

- [x] Vender buscando o produto pelo nome e pelo leitor de código de barras, se houver um.
- [x] Usar os atalhos F2 (buscar) e F9 (finalizar).
- [x] Vender em lote: tocar em "+ fardo" no rodapé do cartão de um produto com fardo cadastrado, juntar
  unidades avulsas no carrinho (ex.: 2 fardos + 3 un.) e conferir o subtotal e, no detalhe da
  venda, "2 fardos de 12 + 3 un.". O estoque baixa em unidades. Na comanda, "+ fardo" lança o
  fardo inteiro.
- [x] Pagar em dinheiro e conferir o troco; dar desconto e tentar um desconto maior que o total.
- [ ] Vender produto com vasilhame: na troca 1 por 1 não pede cliente; se o cliente sai devendo,
  exige cliente.
- [x] Fiado para um cliente sem dívida: vende direto, sem aviso.
- [x] Fiado para um cliente que já deve: aparece o aviso com valor, número de vendas e data da
  mais antiga. "Não, voltar" não vende; "Sim, vender no fiado" vende.
- [x] Tentar vender com estoque insuficiente ("Estoque insuficiente").
- [ ] Com o caixa fechado, vender: a venda sai e o caixa abre sozinho, com o saldo do último
  fechamento (o PDV só avisa, não bloqueia).

## 4. Caixa

- [ ] Abrir o caixa à mão com outro saldo inicial, lançar entrada e sangria, e fechar conferindo
  o resumo por forma de pagamento.
- [x] Ver o histórico de caixas.
- [ ] Como dono, em Lojas › Editar, mudar o "Fechamento automático do caixa" para daqui a poucos
  minutos e deixar o caixa aberto: até 5 minutos depois do horário ele fecha sozinho e aparece
  com a marca "automático" em Caixas anteriores.

## 5. Comandas

- [x] Abrir, lançar itens (o estoque baixa na hora), remover item e fechar no fiado (o aviso deve
  aparecer).
- [x] Cancelar uma comanda: o estoque volta.

## 6. Vendas

- [x] Filtrar por período e forma de pagamento e abrir o detalhe.

- [ ] No Início, vender no fiado: o cartão Faturamento mostra "R$ ... disso foi vendido no
  fiado"; receber um pagamento de fiado e ver o cartão "Fiado recebido".

- [ ] Cancelar uma venda em dinheiro (sai do caixa) e uma fiada (sai da dívida).
- [x] Ver o histórico de alterações da venda.
- [x] Como gerente ou dono, no menu "Lançar venda antiga" (abaixo de Histórico de vendas), lançar uma venda de ontem: ela
  aparece no filtro de ontem com a marca "lançada depois", o estoque baixa e o dinheiro entra no
  caixa aberto agora (veja o resumo do caixa). Uma data no futuro é recusada.
- [x] Como atendente: o botão "Lançar venda antiga" não aparece e a URL mostra "sem permissão".

## 7. Clientes e fiado

- [x] Ver a lista com as colunas "Dívida nesta loja", "Outras lojas" e "Dívida total".
- [x] Marcar o filtro "Só quem deve no fiado".
-- CORRIGIR ABAIXO, pois salva sem adicionar um numero do endereco
- [ ] Cadastrar um cliente com endereço: digitar um CEP real (ex.: 50030-230) e ver rua, bairro,
  cidade e UF preencherem sozinhos; completar número e complemento; conferir o endereço no
  detalhe do cliente. Cadastrar outro sem endereço (é opcional) e testar um CEP inexistente.

- [x] Receber um pagamento automático e um manual (escolhendo por loja).
- [ ] Nos campos de dinheiro (receber fiado, PDV, produto): digitar "1234" mostra "1.234"; o "."
  do teclado numérico vira vírgula; ao sair do campo fica "1.234,00".


- [x] Pagar na Loja B a dívida da Loja A.


-- MELHORAR ABAIXO, receber valor e dar troco
- [ ] Tentar receber mais do que o cliente deve.


- [ ] Emprestar vasilhame; devolver na mesma loja (funciona) e em outra loja (recusado).
- [x] Tentar excluir um cliente que deve: deve ser recusado.
- [ ] Como gerente ou dono, excluir um cliente sem dívida e marcar "Mostrar só os excluídos": ele
  aparece com telefone, endereço e data da exclusão; Reativar o traz de volta. Como atendente, a
  caixa "Mostrar só os excluídos" não aparece.
- [x] Como gerente ou dono, definir um limite de crédito no cliente (Editar) e ver o cartão
  "Limite de crédito" com o valor disponível.


- [ ] Vender no fiado passando do limite: como atendente, aparece o pedido de autorização; o
  gerente digita o e-mail e a senha dele e a venda sai (senha errada é recusada, e o navegador não
  oferece salvar a senha). Gerente e dono veem o aviso e vendem em "Sim, vender acima do limite".
  No detalhe da venda aparece "Acima do limite, autorizado por" com o nome de quem autorizou.


- [x] Como atendente, abrir Editar do cliente: o campo de limite não aparece.

## 8. Estoque, produtos e vasilhames (gerente ou dono)

- [x] Dar entrada e ajuste de estoque e alterar preço.
- [ ] Criar produto em várias lojas e tentar criar com um código repetido.
- [ ] Excluir um produto e reativar em Produtos › "Mostrar só os excluídos" (volta com preço e
  estoque nas lojas).
- [ ] Novo produto com "Preço de venda padrão": as lojas marcadas sem preço próprio usam ele.
- [ ] Criar tipos de vasilhame e lançar movimentações com o fornecedor.

## 9. Permissões (entrar com cada papel)

- [ ] Atendente (`funcionario@exemplo.com`): não vê Produtos, custo, lucro, sangria, painel da
  empresa nem "Dívida total".
- [ ] Logado como atendente, abrir no navegador `/api/stores/<id da loja>/sales`: a resposta
  não pode ter `costPrice`, `totalCost` nem `totalProfit`.
  
  
  --MELHORIA TER UM "GERENTE GERAL"
- [x] Gerente (`gerente@exemplo.com`): vê produtos e sangria, mas não a empresa.


- [x] Digitar na URL uma página proibida para o papel: deve aparecer "sem permissão".

## 10. Assinatura e plataforma (`admin@plataforma.com`)

- [ ] Em `/plataforma`, deixar a organização como "vencida" e entrar como dono: aparece a faixa de
  somente leitura, os botões ficam apagados e fechar o caixa continua liberado.
- [ ] Voltar a organização para "ativa": o acesso completo volta sozinho, sem recarregar a página.
- [ ] Criar uma notificação e ver se ela aparece no sino.
- [ ] Abrir uma organização: as lojas excluídas aparecem com a data, e a seção Pessoas mostra quem
  tem acesso, quem foi removido e as contas desativadas.
- [ ] Em Planos, excluir um plano sem uso, marcar "Mostrar os planos excluídos" e Reativar.

## 11. Geral

- [ ] Usar no celular e no tablet, principalmente o PDV.
- [ ] Botão "?" de várias telas: cada um abre o artigo certo da Central de Dúvidas.
- [ ] Modo escuro, se você usa.
- [x] testar emails, especialmente de redefinir senha
