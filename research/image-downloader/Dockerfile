FROM python:3.13t

WORKDIR /app

# Install useful system packages for data science work
RUN apt-get update && apt-get install -y \
    vim \
    less \
    htop \
    curl \
    wget \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy analysis scripts and structure
COPY scripts/ scripts/
COPY docs/ docs/

# Create directories for data and results
RUN mkdir -p data results

# Default to bash for interactive analysis
CMD ["/bin/bash"]