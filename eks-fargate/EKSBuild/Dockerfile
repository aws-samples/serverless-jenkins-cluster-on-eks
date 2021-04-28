FROM public.ecr.aws/a1p3q7r0/alpine:3.12


ENV KUBECONFIG /home/kubectl/.kube/kubeconfig
ENV HOME /home/kubectl
# ENV KUBECONFIG /root/.kube/kubeconfig


RUN \
	mkdir /root/bin /aws; \
	apk add --update groff less bash python3 py3-pip jq curl docker && \
	pip install --upgrade pip; \
	pip install awscli && \
	apk --purge -v del py-pip && \
	rm /var/cache/apk/* && \
	# Create non-root user (with a randomly chosen UID/GUI).
	adduser kubectl -Du 5566

ADD https://amazon-eks.s3.us-west-2.amazonaws.com/1.19.6/2021-01-05/bin/linux/amd64/kubectl /usr/local/bin/kubectl
#COPY kubectl /usr/local/bin/kubectl

WORKDIR $HOME

COPY entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod a+x /usr/local/bin/kubectl /usr/local/bin/entrypoint.sh


# USER kubectl
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
