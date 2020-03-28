###
### build webircgateway
###
FROM golang:alpine as build-webircgateway
RUN apk add --no-cache \
	build-base \
	git
RUN git clone https://github.com/kiwiirc/webircgateway.git /root/webircgateway/
WORKDIR /root/webircgateway/
RUN make



###
### build kiwiirc
###
FROM node AS build-kiwiirc
RUN git clone https://github.com/kiwiirc/kiwiirc.git /root/kiwiirc/
WORKDIR /root/kiwiirc/
RUN yarn --frozen-lockfile
RUN yarn build



###
### archlinux with fixed emscripten
###
FROM archlinux AS archlinux-with-fixed-emscripten
RUN pacman --noconfirm -Syu --needed base-devel git sudo
RUN pacman --noconfirm -Syu --needed nodejs python binaryen cmake ninja
RUN pacman --noconfirm -Syu --needed npm

# configure sudo
RUN echo "%wheel ALL=(ALL) NOPASSWD: ALL" | tee /etc/sudoers.d/01_wheel_nopasswd

# add non-root user
RUN useradd -m -G wheel user
USER user

RUN git clone https://github.com/vith/archlinux-emscripten-PKGBUILD.git /home/user/archlinux-emscripten-PKGBUILD
WORKDIR /home/user/archlinux-emscripten-PKGBUILD
RUN makepkg

USER root
RUN pacman --noconfirm -U *.pkg.tar.*



###
### build olm
###
FROM archlinux-with-fixed-emscripten AS build-olm
# RUN pacman --noconfirm -Syu # cachebreak
# RUN pacman --noconfirm -Syu --needed base-devel emscripten perl-json cmake jre-openjdk-headless nodejs npm git
# RUN pacman --noconfirm -Scc
# cause /etc/profile.d/emscripten.sh to be sourced
# emcc prints an intro message the first time it runs instead of doing the build
RUN bash -l -c emcc
RUN git clone https://github.com/kiwiirc/olm.git --branch kiwi-fork /root/olm/
WORKDIR /root/olm/
# RUN npm install --no-package-lock
RUN pacman -S --noconfirm perl-json
RUN bash -l -c "make js"



###
### build plugin-olm
###
FROM node AS build-plugin-olm
COPY --from=build-olm /root/olm/ /root/olm/
WORKDIR /root/olm/javascript/
RUN yarn link
COPY . /root/plugin-olm/
WORKDIR /root/plugin-olm/
RUN yarn link olm
RUN yarn --frozen-lockfile
RUN yarn run build-plugin



###
### run webircgateway; serving kiwiirc, plugin-olm
###
FROM alpine as webircgateway
WORKDIR /opt/irc/
RUN apk add --no-cache \
	ca-certificates
COPY --from=build-webircgateway /root/webircgateway/webircgateway /opt/irc/
COPY --from=build-kiwiirc /root/kiwiirc/dist/ /opt/irc/www/
COPY --from=build-plugin-olm /root/plugin-olm/dist/ /opt/irc/www/
EXPOSE 80 443 113
ENTRYPOINT [ "/opt/irc/webircgateway" ]
