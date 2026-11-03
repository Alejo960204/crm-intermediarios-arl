ROL_ROOT = "administrador"        # Administrador (antes «root Admin»)
ROL_CLIENTE = "intermediario"     # Intermediario (antes «cliente»)
ROL_EMPRESA = "empresa"           # Usuario de login de una empresa (creado por el intermediario)
ROL_EMPLEADO = "empleado"         # Empleado de una empresa (creado por la empresa o el administrador)
ROL_ADMIN = ROL_ROOT
ROL_INTERMEDIARIO = ROL_CLIENTE
ROLES_DE_EMPRESA = (ROL_EMPRESA, ROL_EMPLEADO)  # roles que pertenecen a una sola empresa (usuarios.empresa_id)
