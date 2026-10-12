COMPOSE = docker compose

.PHONY: all build up stop down clean fclean re start-docker prune

all: up

build:
	$(COMPOSE) build

up: start-docker
	$(COMPOSE) up -d

stop:
	$(COMPOSE) stop

down:
	$(COMPOSE) down

clean:
	$(COMPOSE) down --rmi all -v

fclean: clean
	docker system prune -af

re: fclean all

start-docker:
	@sudo systemctl start docker

prune:
	docker system prune -af --volumes