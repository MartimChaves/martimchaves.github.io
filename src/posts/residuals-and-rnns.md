---
title: "Part 3: Residual Connections and Sequence Models"
date: "2026-04-24"
description: "Fix vanishing gradients with skip connections, then learn to process sequences with RNNs and LSTMs"
draft: false
tags: ["Reinventing Code Agents", "ML"]
slug: "residuals-and-rnns"
type: "tech"
---

In [Part 2](/blog/neural-networks), we built a two-layer network that solved XOR — and ended with a warning: as networks get deeper, gradients shrink to zero during backpropagation. Early layers stop updating. Training stalls.

This post covers two architectural responses. First, residual connections — the skip-connection trick that lets gradients flow through depth. Second, RNNs and LSTMs — the models built for sequences, which is what code actually is.

### The vanishing gradient problem

In a deep network, each layer multiplies the gradient by its weight matrix during backprop. If those weights are small, the gradient shrinks exponentially with depth. By layer 10, `∂L/∂W¹` is effectively zero.

Sigmoid activations made it worse: `σ'(z)` has a maximum of 0.25, so every sigmoid layer multiplies the gradient by at most 0.25. Ten sigmoid layers → gradient shrinks by 10⁶×.

ReLU helped — its gradient is exactly 1 for active neurons. But multiply by the weight matrix through 50 layers and you still have a problem.

### Residual connections

The fix is a shortcut that bypasses each transformation:

```
x ──────────────────────────► (+)──► output
│                               ▲
└──► linear ──► ReLU ───────────┘
```

Formally:

```
output = F(x) + x
```

`F(x)` is whatever transformation the layer applies. `x` is added back directly — the "residual" term.

Why it works: during backprop, the gradient flows through both paths. The skip path carries the gradient unchanged. Even if `F(x)` kills the gradient entirely, the skip path keeps the signal alive.

```
∂output/∂x = ∂F(x)/∂x + 1
```

The `+1` means the gradient is always at least 1, regardless of depth. This is the architectural idea behind ResNets (2015) and every transformer since.

```python
import numpy as np

def relu(z):
    return np.maximum(0, z)

def relu_grad(z):
    return (z > 0).astype(float)

class ResidualBlock:
    def __init__(self, dim, lr=0.01):
        self.W = np.random.randn(dim, dim) * np.sqrt(2 / dim)
        self.b = np.zeros(dim)
        self.lr = lr

    def forward(self, x):
        self.x = x
        self.z = x @ self.W + self.b
        return relu(self.z) + x

    def backward(self, grad_out):
        grad_relu = grad_out * relu_grad(self.z)
        self.dW = self.x.T @ grad_relu
        self.db = grad_relu.sum(axis=0)
        return grad_relu @ self.W.T + grad_out  # transform path + skip path

    def update(self):
        self.W -= self.lr * self.dW
        self.b -= self.lr * self.db
```

The key line in `backward`: the returned gradient is the sum of both paths. The skip path (`grad_out`) is always present — depth can't kill it.

### The sequence problem

Residual connections fix depth. But there's a different structural problem: code is a sequence, and the networks so far treat each input as independent.

Consider predicting the next token in:

```
def add(x, y):
    return ___
```

The answer depends on context accumulated across the whole line. An MLP sees a fixed-size window of features with no memory of what came before.

You need a model with *state*: one that accumulates information as it processes a sequence.

### Recurrent Neural Networks

An RNN processes sequences one element at a time, maintaining a hidden state `h` that acts as memory:

```
h_t = tanh(x_t @ W_xh + h_{t-1} @ W_hh + b_h)
y_t = h_t @ W_hy + b_y
```

The same weights are reused at every step. `h_{t-1}` carries forward what happened before.

```
x₁ → [h₁] → [h₂] → [h₃] → y
              ↑       ↑       ↑
             x₂      x₃      x₄
```

Training uses backpropagation through time (BPTT): unroll the RNN into a computational graph and apply backprop. A sequence of length 100 becomes a 100-layer network. And there's the problem again: vanishing gradients, but now in time rather than depth. The model can't reliably use context from 50 steps ago.

### LSTMs

Long Short-Term Memory networks solve the long-range memory problem with a gating mechanism. The key addition: a *cell state* `C_t` that flows through time with minimal transformation.

```
i = σ(x_t @ W_xi + h_{t-1} @ W_hi + b_i)    # input gate
f = σ(x_t @ W_xf + h_{t-1} @ W_hf + b_f)    # forget gate
g = tanh(x_t @ W_xg + h_{t-1} @ W_hg + b_g) # cell candidate
o = σ(x_t @ W_xo + h_{t-1} @ W_ho + b_o)    # output gate

C_t = f * C_{t-1} + i * g   # update cell
h_t = o * tanh(C_t)          # new hidden state
```

Three gates control what happens to memory:
- **Forget gate** `f`: how much of the old cell state to keep (0 = forget, 1 = keep)
- **Input gate** `i`: how much of the new candidate `g` to write
- **Output gate** `o`: how much of the cell state to expose as `h_t`

The cell state `C_t` is updated *additively*: `f * C_{t-1} + i * g`. No repeated matrix multiplication — just element-wise scaling and addition. The gradient through `C_t` is nearly direct, which is how LSTMs carry information across hundreds of steps.

```python
def sigmoid(z):
    return 1 / (1 + np.exp(-z))

class LSTMCell:
    def __init__(self, input_dim, hidden_dim):
        d = input_dim + hidden_dim
        self.W = np.random.randn(d, 4 * hidden_dim) * 0.01
        self.b = np.zeros(4 * hidden_dim)
        self.hidden_dim = hidden_dim

    def forward(self, x, h_prev, C_prev):
        n = self.hidden_dim
        combined = np.concatenate([x, h_prev], axis=-1)
        gates = combined @ self.W + self.b

        i = sigmoid(gates[..., :n])
        f = sigmoid(gates[..., n:2*n])
        g = np.tanh(gates[..., 2*n:3*n])
        o = sigmoid(gates[..., 3*n:])

        C = f * C_prev + i * g
        h = o * np.tanh(C)
        return h, C
```

All four gate matrices are computed in one multiply by concatenating the inputs and stacking the weights — a standard efficiency trick you'll see in most implementations.

### What this unlocks

LSTMs were state of the art for sequence modeling until 2017. They could carry context across long sequences, handle variable-length inputs, and trained with BPTT.

But they have two problems. First, they're sequential — you can't parallelize across the time dimension, so training on long sequences is slow. Second, even LSTMs struggle with very long-range dependencies: information is compressed into a fixed-size hidden state, and the forget gate can still discard it.

Part 4 solves both: the attention mechanism, which lets every position in a sequence attend directly to every other position — no recurrence, no compression, no forgetting.
