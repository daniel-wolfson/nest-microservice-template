FROM rabbitmq:3-management

# Switch to root to perform system updates
USER root

# Update packages and install security patches
# RUN apk update && \
#     apk upgrade && \
#     apk add --no-cache \
#         ca-certificates \
#         tzdata && \
#     rm -rf /var/cache/apk/* /tmp/*

# Switch back to rabbitmq user
#USER rabbitmq

# Enable management plugin offline (more secure than runtime enabling)
RUN rabbitmq-plugins enable --offline rabbitmq_management

# Copy configuration file
#COPY --chown=rabbitmq:rabbitmq rabbitmq.conf /etc/rabbitmq/

# Expose ports
#EXPOSE 5672 15672

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD rabbitmq-diagnostics -q ping

# Use exec form for better signal handling
#CMD ["rabbitmq-server"]