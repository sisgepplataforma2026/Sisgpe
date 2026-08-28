function testarValidacaoCpf() {
  var casos = [
    // CPFs matematicamente válidos
    { cpf: "085.381.047-80", esperado: true,  desc: "CPF válido formatado"       },
    { cpf: "08538104780",    esperado: true,  desc: "CPF válido só dígitos"      },
    // Inválidos por dígito verificador
    { cpf: "085.381.047-81", esperado: false, desc: "Dígito verificador errado"  },
    { cpf: "123.456.789-09", esperado: false, desc: "CPF inválido comum"         },
    // Inválidos por formato
    { cpf: "000.000.000-00", esperado: false, desc: "Sequência repetida zeros"   },
    { cpf: "111.111.111-11", esperado: false, desc: "Sequência repetida uns"     },
    { cpf: "1234567",        esperado: false, desc: "Menos de 11 dígitos"        },
    { cpf: "",               esperado: false, desc: "CPF vazio"                  },
    { cpf: null,             esperado: false, desc: "CPF null"                   }
  ];

  var erros = 0;

  casos.forEach(function(c) {
    var resultado = cpfValido(c.cpf);
    var ok = resultado === c.esperado;
    if (!ok) erros++;
    Logger.log(
      (ok ? "✅" : "❌") + " " + c.desc +
      " → esperado: " + c.esperado +
      ", obtido: " + resultado
    );
  });

  Logger.log(erros === 0
    ? "✅ Todos os casos passaram."
    : "❌ " + erros + " caso(s) falharam."
  );
}
function testarMotorTextoOficio() {
  var dados = {
    tipo: "Taxa Negocial",
    escola: "Teste",
    cnpj: "36.136.001/0001-05",
    colaboradores: ["Wanderson Nascimento Castelo"]
  };

  var proc = montarDadosOficio_(dados, "preview");

  Logger.log("TIPO NORMALIZADO: " + proc.tipoNorm);
  Logger.log("TEXTO GERADO:");
  Logger.log(proc.corpoTexto);

  return proc.corpoTexto;
}