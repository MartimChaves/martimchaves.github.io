---
title: "Reinventing Logistic Regression"
date: "2026-07-22"
description: "From 19th-century population modeling to gradient descent"
draft: false
tags: ["ML","Python","AI"]
slug: "logistic-regression"
type: "tech"
---

In the mid-19th century, in Belgium, there was Pierre Verhulst. At the time, people were worried about famine and chaos. Around four decades earlier, Malthus had argued that population could grow exponentially while the food supply would grow linearly. You get a lot of people, but not a lot of food. Then you get, unfortunately, famine, deaths, and chaos. These crises would slow population growth, perhaps even reducing it enough to produce some sort of equilibrium.

````tangent
What does it mean for population to grow exponentially?

Population grows exponentially when its rate of growth is proportional to its current size: the more people there are, the more people there are who can have children. This can happen when births consistently exceed deaths, although the real calculation also depends on generation time, age structure, migration, and other factors.

Looking at the world today, the population has indeed grown a lot over the last century. Generally speaking, agricultural technology and food production have grown alongside it, although access to that food is far from equal.

Play around with the parameters (life expectancy, number of children per couple, age at which they have them) below and check out how they affect population growth. A few assumptions are being made here, such as that every couple has children, every couple has the same age, and that the population at the start is mostly young people.


```population-growth
```
````

```interactive-plot xMin=-1 xMax=5 yMin=-1 yMax=5
exp(x)-1
x
```
Fig. 1 - Exponential growth versus linear growth

Pierre set off to try and model that. Population would initially grow exponentially, but, at some point, the number of people itself would slow that growth as the population approached a limit. A modern normalized version of the logistic function he developed is $\frac{1}{1 + e^{-rx}}$, with $r$ controlling the growth rate.

```interactive-plot xMin=-6 xMax=6 yMin=-0.2 yMax=1.2
1/(1 + exp(-1*x))
```
Fig. 2 - A logistic function

You can play around with the growth rate to increase or decrease the slope around the y-axis. The higher $r$ is, the steeper the curve becomes. As written, the function converges towards $1$. If you want it to converge to a hypothetical population limit, you can multiply the whole function by that limit, $K$, giving $\frac{K}{1 + e^{-rx}}$. This is still a simplified form whose midpoint is fixed at $x=0$.

This seemingly simple function is actually quite powerful, because it allows us to convert any number to a value between 0 and 1 - and this, it turns out, came in really handy in the realm of probabilities.

### The logistic function and probabilities

The logistic function was never meant to be used for probabilities, but by the late 19th and early 20th centuries, S-shaped curves like the logistic function were showing up all over the place. In chemistry, certain reactions could be represented by an S-curve (autocatalytic reactions). The Hill equation showed that blood oxygen saturation also follows an S-curve. Researchers studying the adoption of technology in agriculture and other domains also found S-curves. The logistic function was a great fit for all of these phenomena. It was found in situations where growth of something depended on that something but it eventually had to reach a limit. So, I guess you could say, the logistic function was in the air.

At the same time, a revolution in medicine was happening. For a long time, there was little standardization in the amounts of remedies to administer, and doctors mostly relied on experience. But medicine, along with everything else, was going industrial. Drugs were no longer created and administered *ad hoc* by doctors; they came in bottles and boxes, and they had to have a potency label. So researchers studying the effects of these drugs wanted to standardize dosages. How much should be enough, and how much is definitely too much?

Researchers were giving different doses of a drug to lab subjects and seeing whether or not each one responded. Individually, the outcome was binary: the treatment either worked or it didn't. Across a population, however, something interesting emerged. At very low doses, almost none of the subjects responded. At very high doses, almost all of them did. In between, the **fraction** of subjects that responded steadily increased with the dose. Sound familiar? Researchers were once again looking at an S-shaped curve, one that could describe the relationship between a dose and the fraction, or estimated probability, of individuals responding.

So we're in the 1920s and 1930s, and we need an S-curve to describe the impact of a dose of a certain drug. Researchers wanted to compare different drugs, see how they affected people differently, determine the right dose, and decide which one was best, which one had fewer side effects, for example. They wanted to model the data with a function: a function that could convert a dose into a probability of response.

Now, a caveat: researchers experimented with several different functions. "Probit models" were already prominent, and they never disappeared. The logistic function was proposed for a study on the potency of a drug in the 1940s and eventually became one of the most widely used ways to convert a score into a probability.

Why did the logistic function become so useful? One reason is that it is mathematically easy to work with, especially because its inverse is simple. I'm not sure if Pierre realized this when he was playing around with the logistic function to model population, but that inverse turns out to be very handy. If we consider $p$ to be the probability, and $d$ the dose, applying the logistic function we get:

$$
p = \frac{1}{1 + e^{-d}}
$$

Now, what if we want to go *backwards*? That is, what value of dose gives us a certain probability of success? Applying the inverse gives us:

$$
d = \ln\!\left(\frac{p}{1-p}\right)
$$

`````tangent
How do we go from $p = \frac{1}{1 + e^{-d}}$ to $d = \ln\!\left(\frac{p}{1-p}\right)$?

First, multiply both sides by $(1 + e^{-d})$:

$$
p \cdot (1 + e^{-d}) = 1
$$

Divide both sides by $p$:

$$
1 + e^{-d} = \frac{1}{p}
$$

Subtract $1$ from both sides:

$$
e^{-d} = \frac{1}{p} - 1 = \frac{1}{p} - \frac{p}{p} = \frac{1 - p}{p}
$$

Take the natural log of both sides:

$$
-d = \ln\!\left(\frac{1-p}{p}\right)
$$

And finally, multiply by $-1$ (which flips the fraction inside the log):

$$
d = \ln\!\left(\frac{p}{1-p}\right)
$$

````tangent
Why does multiplying by $-1$ flip the fraction inside the $\ln$?

First: why is $a^{-1} = \frac{1}{a}$? There's a pattern when you decrease the exponent by one. Using $a = 2$:

$$
2^3 = 8 \quad \rightarrow \quad 2^2 = 4 = \frac{8}{2} \quad \rightarrow \quad 2^1 = 2 = \frac{4}{2} \quad \rightarrow \quad 2^0 = 1 = \frac{2}{2}
$$

Every step down divides by $2$. We continue with the pattern after $0$:

$$
2^{-1} = \frac{1}{2} \quad \rightarrow \quad 2^{-2} = \frac{1}{4} \quad \rightarrow \quad 2^{-3} = \frac{1}{8}
$$

So $a^{-1}$ is just what you get when you keep dividing; it's $\frac{1}{a}$.

Second: why $\ln(a^b) = b \cdot \ln(a)$. This follows from the fact that logarithms turn multiplication into addition. But why do they do that? It comes from how exponents work. When you multiply two powers of the same base, you add the exponents:

$$
e^3 \cdot e^2 = (e \cdot e \cdot e) \cdot (e \cdot e) = e^{5} = e^{3+2}
$$

Now, $\ln$ is just the question "e to what power gives me this?" If $\ln(x) = m$ and $\ln(y) = n$, that means $e^m = x$ and $e^n = y$. So:

$$
x \cdot y = e^m \cdot e^n = e^{m+n}
$$

And asking "e to what power gives me $x \cdot y$?" gives us $m + n$, which is $\ln(x) + \ln(y)$.

If we apply the logarithm to $x \cdot y$ we get $\ln(x \cdot y) = \ln(e^{m+n}) = m + n = \ln(x) + \ln(y)$. So, multiplication on the inside became addition on the outside.

With that in hand: $\ln(a \cdot a) = \ln(a) + \ln(a)$. But $a \cdot a$ is just $a^2$, so:

$$
\ln(a^2) = \ln(a) + \ln(a) = 2 \cdot \ln(a)
$$

And $a \cdot a \cdot a = a^3$, so $\ln(a^3) = \ln(a) + \ln(a) + \ln(a) = 3 \cdot \ln(a)$. In general, $\ln(a^b) = b \cdot \ln(a)$.

Now plug in $b = -1$. We get $\ln(a^{-1}) = -1 \cdot \ln(a) = -\ln(a)$. And since we just showed $a^{-1} = \frac{1}{a}$:

$$
\ln\!\left(\frac{1}{a}\right) = -\ln(a)
$$

Negating a log flips the thing inside. That gives us our last step:

$$
-\ln\!\left(\frac{1-p}{p}\right) = \ln\!\left(\frac{p}{1-p}\right)
$$
````
`````

You might be familiar with this function! It's none other than the log of the odds, or the logit function!


````tangent
What are odds? And why use the log of the odds?

The general idea of odds has been around for a long time. The word itself hints at its meaning: something unequal. Imagine that you're in ancient Rome, watching a chariot race. You might turn to the person beside you and say, "I'll give you two coins if Aurelius wins; you'll give me one coin if Romulus wins!" You confidently expect Aurelius to win. In that inequality, there's an implicit ratio: you think Aurelius is twice as likely to win as Romulus. In other words, if they were to race three times, you would expect Aurelius to win twice and Romulus once.

In simple terms, when stating the odds of something, we're saying how often we'll win ($W$) versus how often we'll lose ($L$), represented as $W:L$. Often, one of those numbers is set to 1, as when simplifying a fraction, giving $\frac{W}{L}:1$. This is a bit different from a probability. If we want to know the probability of winning, we calculate $\frac{W}{W+L}$, or $\frac{W/L}{W/L+1}$. So let's say $X = \frac{W}{L}$. This means that $P = \frac{X}{X+1}$. If we solve for $X$, we get $X = \frac{P}{1-P}$, the odds function we've seen before.

There is one annoying thing about odds, though: they're not symmetrical. If winning is twice as likely as losing, then the odds are $2:1$. If it is half as likely as losing, the odds are $0.5:1$. If winning is just as likely as losing, then the odds are $1:1$. Twice as likely or half as likely feel like they should be equidistant from $1$, but they aren't. Plus, odds can go from $0$ to $\infty$: an unlikely win is "crammed" into the space between $0$ and $1$, while the odds of a likely win can range from $1$ to $\infty$.

A way to "solve" this is by taking the log of the odds. The log of the space between $0$ and $1$ is as "large" as the log of the space between $1$ and $\infty$. And, it's also symmetrical around the value $1$: $\ln(0.5) \approx -0.69$ and $\ln(2) \approx 0.69$. Now we get symmetry.

````

At the time, and even today, researchers had an intuition for what log-odds mean and how to compare two log-odds values. In the same way that you and I have an intuitive idea of what 1.5 meters means, or 5 feet if you're used to imperial units, researchers had an intuition for the log-odds scale.

For example, consider drug A and drug B. At a dose of 2 milligrams, suppose drug A has log-odds of response equal to 1.7, while drug B has log-odds of response equal to 2.5. Log-odds of 0 correspond to $1:1$, or even odds. Increasing the log-odds by one multiplies the odds by $e$, which is around 2.7. Here, the difference is 0.8, so the odds of a response with drug B are $e^{0.8} \approx 2.23$ times the odds with drug A at the same dose. This allows us to compare the odds of response between the two drugs.

That familiarity was useful, but something else mattered as well: instead of working directly with probability data, researchers could apply the log-odds transformation. This meant that they could model the relationship between probability (viewed as log of odds) and dosage in a linear way!

At this point, we have to make a slight correction. Our simplified equation, $d = \text{p}$, assumes the same characteristics for each drug. To describe different drugs and dose-response relationships, we need to add parameters. So, really, we're dealing with $\alpha + \beta d$.

So, summarizing, we're looking at:
$$
\alpha + \beta d = \ln\!\left(\frac{p}{1-p}\right)
$$

You might be confused by the $\ln\!\left(\frac{p}{1-p}\right)$ - but remember, this really is just there to remind us that we're applying the log odds transformation to the raw probability data.

If we consider the following:
$$
p^* = \ln\!\left(\frac{p}{1-p}\right)
$$

Then, we can write:

$$
p^* = \alpha + \beta d
$$

Cool, right? Instead of having to deal with this:

```interactive-plot xMin=-1 xMax=8 yMin=-0.1 yMax=1.1
1/(1 + exp(-(-3 + x)))
```
Fig. 4 - Dose vs. probability of response: an S-curve.

We can actually work with this:

```interactive-plot xMin=-1 xMax=8 yMin=-5 yMax=5
-3 + x
```
Fig. 5 - Dose vs. log-odds of response: a straight line.

It's the same data! And we're still capturing the relationship between the dose and (a transformed) probability. At the core, we're using the logistic function, but we can manipulate it so that it's easier to understand. $\alpha$ is the log-odds when the dose is zero. The line itself crosses zero when $d=-\alpha/\beta$, and that is the dose at which we have a 50/50 chance of response. $\beta$ is the slope, and it tells us how sharply the log-odds of response change with the dose. Remember, we're in the early 20th century, there are no computers or graphing calculators available, and estimating these two numbers from a straight line is something that we can do with a ruler and a pencil!

### From the logistic function to logistic regression

When the 1940s came around, researchers wanted to know the probability of getting a response to a certain dosage with more accuracy, and for that they looked at other relevant variables, such as the patient's age. This meant that the equation would have more terms.

This leads to one key difference: now we have more variables, so making groups gets tricky. Before, we could aggregate around dosages (2 mg, 2.5 mg, 3 mg, ...), but each subject is a unique combination of dose and age. We're better off using the individual data points instead of aggregating them. For each individual, the observed response is binary: did they respond or not? We'll use $y$ for this observed response. If the subject responded, we'll consider $y=1$; otherwise, we'll consider $y=0$.

So, now, we get something like this:

$$
y = \frac{1}{1 + e^{-(a + b_1 \cdot \text{dose} + b_2 \cdot \text{age})}}
$$


Reminder: we **have** the fundamental data. That is, we know the observed value of $y$ for each measured dose and age. What we need to find are $a$, $b_1$, and $b_2$. For this particular model and dataset, these three parameters summarize how the drug's predicted response relates to dose and age.

This isn't really something that we can do with a ruler and pencil anymore. But, lucky for us, there are other ways to get these parameters. Figuring them out is what we call "fitting the parameters to the data", or in other words, **regression**. And since we're using the logistic function, this is called **logistic regression**. We have arrived!

But how exactly do we fit these parameters?

There are many different ways of doing that, some involving more complex calculations than others. As computers became more widely available, fitting these models became much easier and more popular. The method that we'll explore is **gradient descent**. To use gradient descent, we first have to talk about **loss functions**.

#### Loss functions? I'm at a loss here...

So, for a certain subject with a specific dose and age, we **know** what $y$ is; we got it from real-world data.

Now, what we're trying to do is **find** the parameters $a$, $b_1$, and $b_2$. This way, we can build a function that matches and **describes** the real-world data. From there, we can use the parameters to summarize the relationship and compare it with relationships for other drugs. To get fancy, we can "model" the drug.

To get started, we actually assign random values to the parameters. Then, we can calculate a "temporary $y$" for each data point - we'll use $\hat{y}$ to represent that value. This $\hat{y}$ is going to be different from the real value, because we're using random parameters. So, now we have two different "$y$s": the real expected value, the one we got from real data - $y$ - and the value that we get from our function with randomly initialized parameters - $\hat{y}$. To distinguish between these two, we'll be using the term "label" for the real value $y$, and we'll be using the term "prediction" for the value that we get from our function, $\hat{y}$. We use "label" as in the true label, the real value. We use prediction because, later on, we'll use the function with the appropriate parameters (parameters that fit the data), to predict values for data points with doses and ages that we haven't measured yet.

Loss is a word we use to mean **difference** - the difference between the label and the prediction. The smaller the difference, the better! The smaller the difference, the more accurate our function is, which is what we want. The simplest loss function is just: $L = y - \hat{y}$. That's it. But the thing with that loss function, is that it can be negative. This is a problem if we're averaging out the losses for different subjects, because then positive and negative losses can cancel each other out, giving us an overall false sense of accuracy.

So, we can ask ourselves, what would be a good loss function that would work with logistic regression? A good way to think about this is by asking how big the loss should be?

Say that a subject responded, so $y=1$. If our prediction is $\hat{y}=0.9$, then the loss should be small. If our prediction is $\hat{y}=0.1$, then the loss should be big. If our prediction is $\hat{y}=0.01$, then the loss should be really big, and ideally much larger than the loss when $\hat{y}=0.1$ - because this way, we're punishing very confident errors.

To do this, we can use the log of the prediction. $\ln(1) = 0$, which is perfect, since if $y=1$ and $\hat{y}=1$, then the loss should be 0. Then, $\ln(0.9) = -0.105$, $\ln(0.1) = -2.303$, and $\ln(0.01) = -4.605$. Notice how the more wrong the prediction is, the larger the absolute value becomes. The only issue is that it's negative, but we can deal with this by multiplying it by $-1$. So, when $y=1$, we can calculate the loss using $-\ln(\hat{y})$.

What if a subject did not respond, so $y=0$? Then, symmetrically, the loss should be small when $\hat{y}=0.1$, big when $\hat{y}=0.9$, and really big when $\hat{y}=0.99$. We can use the log again, but we need the log of $1-\hat{y}$ instead of $\hat{y}$. For example, if we predict 0.9, $-\ln(1-0.9) = -\ln(0.1) = 2.303$. Then, $-\ln(1-0.99) = -\ln(0.01) = 4.605$. Again, the more wrong the prediction is, the larger the loss becomes. Meanwhile, $-\ln(1-0.1) = -\ln(0.9) = 0.105$ and $-\ln(1-0.01) = -\ln(0.99) = 0.010$, so the loss approaches zero as the prediction improves.

Great, so now we just have to combine these two different functions, so that when $y=1$ we use $-\ln(\hat{y})$ and when $y=0$ we use $-\ln(1-\hat{y})$. We can do this by using the following formula:

$$
L = y \cdot -\ln(\hat{y}) + (1-y) \cdot -\ln(1-\hat{y})
$$

Note that the label determines what gets used: if $y=1$, then $(1-y)=0$, so only the first term is used; if $y=0$, then $(1-y)=1$, so only the second term is used.

By the way, this is called the cross-entropy loss. This comes from information theory, and honestly we would be going down a rabbit hole to understand why it's called that. But now that we reinvented loss functions, more specifically the cross-entropy loss function, we can move on to the next key step, which is **gradient descent**.

#### Down with the gradient!

So, we initialized our function with random parameters, and we calculated the loss for one of our subjects. How do we go from that to changing our parameters so that the prediction gets closer to the label?

We could try manually changing the parameters. For each subject, we can choose new parameters that would get us an extremely confident prediction with very low loss. But then, we would probably be choosing completely different parameters for each subject, and we would be no closer to finding the optimal parameters for all subjects.

Let's check out an example. Below you'll find a widget that lets you tune the parameters of the logistic function - essentially letting you manually attempt regression. By default, there are only two subjects, and in each round of tuning the focus is on a single subject. Change the parameters, watch what the prediction is, how it compares to the label, and what the loss is. Once you've found a set of parameters that leads to a low loss for that subject, click proceed. Note that this will actually calculate the predictions and losses for **all** subjects, and the average loss will be plotted below. After this, the focus will be on another subject, and you can try to find a new set of parameters for that subject, and check out how that set of parameters affects the other subjects' losses. The idea is to find parameters that work well for all subjects. Each round of tuning is called a "step". Ideally, as the step count increases, the average loss should decrease - this is how you will know that you are finding parameters that fit the data. You can add more subjects if you'd like!

```parameter-tuner
```

How did it go? Since it's just three parameters, you might've actually ended up cracking it - if so, nice! But I hope I got the point across, that choosing parameters *ad hoc*, fitting subjects one by one, is probably not going to work. Real-world data ends up being more complex, and often the number of parameters is much larger than three. You might want to include things such as weight, height, and many more, with an additional parameters for each one.

You might've tried to do small nudges, instead of changing all of the parameters for each subject. Say, find something that works for a subject, and then for other subjects do small alterations. That's a good principle! Ideally, though, it would be nice to know *how* to change the parameters, in which direction... So, what if we try to find a way to relate the loss to the parameters, so that we can nudge the parameters in a good direction? Say, a function where the loss depends on the parameters.

Well, we can do that! Remember that $L$ depends on $\hat{y}$. And, $\hat{y}$ depends on the parameters. So, we **can** write $L$ as a function of the parameters. So this means that we can relate the parameters to the loss, and we can then understand how the loss changes according to the parameters. If we understand how that happens, we can look for the direction that produces the largest change in the loss - that's the derivative!

````tangent
How can we relate the parameters to the loss?

This tangent provides analytical proof that we can write a function where the loss depends on the parameters. It's a bit verbose! It's only really worth it if you want to be more confident, or would like more proof.

For a given subject $i$, the dose, age, and label are fixed values. The things we are changing are $a$, $b_1$, and $b_2$.

First, the parameters and the subject's features are combined into a score that we represent with the letter $z$:

$$
z_i(a,b_1,b_2) = a + b_1 \cdot \text{dose}_i + b_2 \cdot \text{age}_i
$$

Next, the logistic function turns that score into a prediction. To keep the equations compact, we'll use the Greek letter sigma, $\sigma$, to represent the logistic function from now on:

$$
\sigma(z) = \frac{1}{1+e^{-z}}
$$

This is only a shorthand for the same logistic function we've been using, it isn't a new function. For subject $i$, the prediction is therefore:

$$
\hat{y}_i(a,b_1,b_2) = \sigma\left(z_i(a,b_1,b_2)\right)
$$

The loss compares that prediction with the subject's fixed label, $y_i$:

$$
L_i = -y_i\ln(\hat{y}_i) - (1-y_i)\ln(1-\hat{y}_i)
$$

Now we can substitute the prediction into the loss. This gives us a loss that depends directly on the parameters:

$$
\begin{aligned}
L_i(a,b_1,b_2)
&= -y_i\ln\left(\sigma\left(z_i(a,b_1,b_2)\right)\right) \\
&\quad -(1-y_i)\ln\left(1-\sigma\left(z_i(a,b_1,b_2)\right)\right)
\end{aligned}
$$

So, we are building $L_i(a,b_1,b_2)$, not just $L(a)$. Writing $L(a)$ would mean that $b_1$ and $b_2$ were being held fixed while only $a$ was allowed to change.

So there we have it, how the loss depends on the parameters.

````

To calculate the derivative of the loss with respect to the parameters, a good way to do that is using the **chain rule**:

$$
\frac{\partial L_i}{\partial \theta}
= \frac{\partial L_i}{\partial \hat{y}_i}\frac{\partial \hat{y}_i}{\partial \theta}
$$

Here, we're using $i$ as an index that identifies one specific subject. So $L_i$ is the loss of subject $i$, with $i$ ranging from $1$ to the number of subjects in the dataset.

`````tangent
What is the chain rule?

The chain rule is useful when one value affects another value through one or more intermediate steps. Just like the name implies, the idea is that there are links between the different values, like a chain!

Suppose you have a final value $F$. The value $F$ depends on an intermediate value $g$, and $g$ depends on a parameter $\theta$. If $F$ depends on $g$, and $g$ depends on $\theta$, then we can also say that $F$ depends on $\theta$!

That's what the chain rule says: the derivative of $F$ with respect to $\theta$ is the product of the derivative of $F$ with respect to $g$ and the derivative of $g$ with respect to $\theta$.

````tangent
Hold on, what is a derivative?

Derivative means change, more specifically "how much change". For example, a speed of 100 kilometers per hour (or 60 miles per hour) is a derivative, a derivative of distance with respect to time - it tells you how much distance is being covered in a measure of time. Specifically, 100 kilometers are being covered every hour.

So, a derivative measures how much one value changes when another value changes. To be precise, it measures how much one value changes when another value changes by a *very small amount*. In the previous example, we would actually measure the derivative by looking at how much distance was covered in a second, or less... From there, if we wanted, we could convert it to a standard that we're familiar with, like kilometers per hour.

Why are we only interested in measuring that change when the change is very small? Because that gives us the **instantaneous rate of change** at that particular point. Going back to the car example, if you're standing still, and there's a very long straight, and then you fully press on the gas - in the beggining the speed of the car will change very fast, but as time goes on, the speed will increase more and more slowly, until it reaches a plateau - that's the acceleration, the derivative of the speed with respect to time. In the beginning, the acceleration is large, as the speed increases very fast. But, when the speed plateaus, the acceleration is zero, since the speed doesn't change. So the derivative of the speed with respect to time, which we casually call the acceleration, has a different value dependinding on for how long we've started steping on the gas. The derivative at any given moment tells us the rate of change at that exact moment, not the average change over a longer period of time - which is why when we measure it, we want to measure it in the smallest amount of unit possible!

Note that this example contains two derivatives: the derivative of distance with respect to time, which is speed, and the derivative of speed with respect to time, which is acceleration. Even though they're related, they're two different things! The widget below illustrates this with a car racing on a track. On the long straights, it accelerates and eventually reaches a speed plateau. As it approaches a corner, it decelerates before maintaining a lower, constant speed through the corner. Below the track, you can find a speed plot and an acceleration plot. Pause the car to see the acceleration estimated from the nearby speed values. You can also drag the plots horizontally to inspect another point in time.

```derivative-car
```

We'll represent partial derivatives using the $\partial$ symbol and a fraction. For example,

$$
\frac{\partial F}{\partial g}
$$

asks: if we nudge $g$ slightly, how much does $F$ change?

- A positive derivative means that increasing $g$ increases $F$.
- A negative derivative means that increasing $g$ decreases $F$.
- A derivative close to zero means that a small change in $g$ barely changes $F$.

We use the partial-derivative symbol $\partial$ here because our functions can depend on several values. It means that we change one value while treating the others as fixed.
````

And we can represent it like this:

$$
\frac{\partial F}{\partial \theta}
= \frac{\partial F}{\partial g}\frac{\partial g}{\partial \theta}
$$

The first derivative measures how $F$ changes when $g$ changes. The second measures how $g$ changes when $\theta$ changes. Multiplying them tells us how $F$ ultimately changes when $\theta$ changes.

But why does multiplying the derivatives work? Think about what happens when we make a very small change, $\Delta\theta$, to $\theta$ - we'll use the $\Delta$ symbol to represent a small change.

The resulting change in $g$ is approximately:

$$
\Delta g \approx \frac{\partial g}{\partial \theta}\Delta\theta
$$

That small change in $g$ then produces a change in $F$:

$$
\Delta F \approx \frac{\partial F}{\partial g}\Delta g
$$

Substituting the first relationship into the second gives us:

$$
\Delta F \approx \frac{\partial F}{\partial g}\frac{\partial g}{\partial \theta}\Delta\theta
$$

Dividing both sides by $\Delta\theta$ shows the overall rate at which $F$ changes with $\theta$:

$$
\frac{\Delta F}{\Delta\theta}
\approx \frac{\partial F}{\partial g}\frac{\partial g}{\partial \theta}
$$

Another way to see the same idea is to treat the derivatives as change ratios: $(\Delta F/\Delta g)(\Delta g/\Delta\theta)$. The intermediate $\Delta g$ cancels, leaving $\Delta F/\Delta\theta$. As the changes become infinitesimally small, these approximations become the exact chain-rule relationship.


In our case:

- The final value $F$ is the loss, $L_i$.
- The intermediate value $g$ is the prediction, $\hat{y}_i$.
- The parameter $\theta$ can be $a$, $b_1$, or $b_2$.

So the application of the chain rule is:

$$
\frac{\partial L_i}{\partial \theta}
= \frac{\partial L_i}{\partial \hat{y}_i}\frac{\partial \hat{y}_i}{\partial \theta}
$$

`````

Each parameter changes the prediction, and the prediction changes the loss. We can start with the first part of that chain - the derivative of the loss with respect to the prediction:

$$
\frac{\partial L_i}{\partial \hat{y}_i} = -\frac{y_i}{\hat{y}_i} + \frac{1-y_i}{1-\hat{y}_i}
$$

`````tangent
How did we get the derivative of the loss with respect to the prediction?

Start with the loss for subject $i$:

$$
L_i = -y_i\ln(\hat{y}_i) - (1-y_i)\ln(1-\hat{y}_i)
$$

We are differentiating with respect to the prediction, $\hat{y}_i$, so the label $y_i$ is treated as a constant.

For the first term, the derivative of $\ln(\hat{y}_i)$ is $1/\hat{y}_i$:

$$
\frac{\partial}{\partial\hat{y}_i}\left[-y_i\ln(\hat{y}_i)\right]
= -\frac{y_i}{\hat{y}_i}
$$

````tangent
Why is the derivative of $\ln(x)$ equal to $1/x$?

Check out the plots of $\ln(x)$ and its derivative, $1/x$, below. By the way, we're using $\ln'(x)$ to represent the derivative, the function with an added $'$.

Note how the "growth" of the logarithm flattens out as $x$ increases - this should align with a derivative that decreases, tending towards zero. And in the beginning, the growth is astronomical, since it's departing from $-\infty$. The function that describes this is $1/x$.

```log-derivative
```

````

For the second term, we use the chain rule again.

To make the two links easier to see, temporarily let

$$
x=1-\hat{y}_i.
$$

Now $\ln(1-\hat{y}_i)$ becomes $\ln(x)$. A small change in $\hat{y}_i$ first changes $x$, and that change in $x$ then changes $\ln(x)$. The chain rule connects those two rates:

$$
\frac{\partial\ln(x)}{\partial\hat{y}_i}
= \frac{\partial\ln(x)}{\partial x}
  \frac{\partial x}{\partial\hat{y}_i}.
$$

The first derivative is $1/x$. The second is $-1$: if $\hat{y}_i$ increases by a very small amount, $1-\hat{y}_i$ decreases by exactly that amount. Replacing $x$ with $1-\hat{y}_i$ gives us:

$$
\begin{aligned}
\frac{\partial}{\partial\hat{y}_i}\ln(1-\hat{y}_i)
&= \frac{1}{1-\hat{y}_i}\cdot(-1) \\
&= -\frac{1}{1-\hat{y}_i}
\end{aligned}
$$

That negative sign cancels the negative sign already in the loss:

$$
\frac{\partial}{\partial\hat{y}_i}\left[-(1-y_i)\ln(1-\hat{y}_i)\right]
= -(1-y_i)\left(-\frac{1}{1-\hat{y}_i}\right)
= \frac{1-y_i}{1-\hat{y}_i}
$$

Adding the derivatives of the two terms gives us:

$$
\frac{\partial L_i}{\partial \hat{y}_i}
= -\frac{y_i}{\hat{y}_i} + \frac{1-y_i}{1-\hat{y}_i}

$$

`````

Next, the derivatives of the prediction with respect to each parameter are:

$$
\begin{aligned}
\frac{\partial \hat{y}_i}{\partial a}   &= \hat{y}_i(1-\hat{y}_i) \\
\frac{\partial \hat{y}_i}{\partial b_1} &= \hat{y}_i(1-\hat{y}_i)\cdot\text{dose}_i \\
\frac{\partial \hat{y}_i}{\partial b_2} &= \hat{y}_i(1-\hat{y}_i)\cdot\text{age}_i
\end{aligned}
$$

````tangent
How are the prediction derivatives calculated?

Start with the prediction written as the logistic function's full formula:

$$
\hat{y}_i = \frac{1}{1+e^{-(a+b_1\cdot\text{dose}_i+b_2\cdot\text{age}_i)}}
$$

Let $x$ temporarily stand for the entire linear expression inside the function, so:

$$
\hat{y}_i = \frac{1}{1+e^{-x}}
$$

We can use the chain rule again:

$$
\frac{\partial \hat{y}_i}{\partial \theta}
= \frac{\partial \hat{y}_i}{\partial x}\frac{\partial x}{\partial \theta}
$$

The chain rule appears twice: first inside the prediction derivative, and then again when connecting the prediction to the loss.

The derivative of the logistic function with respect to $x$ is:

$$
\frac{d}{dx}\left(\frac{1}{1+e^{-x}}\right)
= \frac{e^{-x}}{(1+e^{-x})^2}
$$

I'm not going to lie, this one is a bit tricky to explain, and we'd be going down a rabbit hole explaining why that is. If you want to understand this, you can start with [this video](https://www.youtube.com/watch?v=5HzVMZKk9pk).

The nifty thing is that final expression, $\frac{e^{-x}}{(1+e^{-x})^2}$, is actually the same as $\hat{y}_i(1-\hat{y}_i)$:

$$
\hat{y}_i(1-\hat{y}_i)
= \frac{1}{1+e^{-x}}\left(1-\frac{1}{1+e^{-x}}\right)
= \frac{e^{-x}}{(1+e^{-x})^2}
$$

Now consider how the linear expression changes with each parameter:

$$
\begin{aligned}
\frac{\partial}{\partial a}(a+b_1\cdot\text{dose}_i+b_2\cdot\text{age}_i) &= 1 \\
\frac{\partial}{\partial b_1}(a+b_1\cdot\text{dose}_i+b_2\cdot\text{age}_i) &= \text{dose}_i \\
\frac{\partial}{\partial b_2}(a+b_1\cdot\text{dose}_i+b_2\cdot\text{age}_i) &= \text{age}_i
\end{aligned}
$$

Multiplying the common logistic-function derivative, $\hat{y}_i(1-\hat{y}_i)$, by $1$, $\text{dose}_i$, or $\text{age}_i$ gives the three prediction derivatives shown above.

````

Now the chain rule connects each parameter to the loss through the prediction.


$$
\begin{aligned}
\frac{\partial L_i}{\partial a}   &= \frac{\partial L_i}{\partial \hat{y}_i}\frac{\partial \hat{y}_i}{\partial a}   = \hat{y}_i-y_i \\
\frac{\partial L_i}{\partial b_1} &= \frac{\partial L_i}{\partial \hat{y}_i}\frac{\partial \hat{y}_i}{\partial b_1} = (\hat{y}_i-y_i)\cdot\text{dose}_i \\
\frac{\partial L_i}{\partial b_2} &= \frac{\partial L_i}{\partial \hat{y}_i}\frac{\partial \hat{y}_i}{\partial b_2} = (\hat{y}_i-y_i)\cdot\text{age}_i
\end{aligned}
$$

In each line, the terms from the loss and the logistic function cancel in a way that leaves the simple prediction error, $\hat{y}_i-y_i$.

Hurray, we found it! A way to know how the loss depends on the parameters! And these three functions, $\hat{y}_i-y_i$, $(\hat{y}_i-y_i)\cdot\text{dose}_i$, and $(\hat{y}_i-y_i)\cdot\text{age}_i$, are the partial derivatives of the loss with respect to each parameter. Together, they form the **gradient**: $\nabla L_i(a,b_1,b_2)$. We can write it like this:

$$
\nabla L_i(a,b_1,b_2) = (
    \hat{y}_i-y_i,
    \space
    (\hat{y}_i-y_i)\cdot\text{dose}_i,
    \space
    (\hat{y}_i-y_i)\cdot\text{age}_i
)
$$

It tells us how a small change to each parameter would affect this subject's loss.

But fitting one subject at a time is, as we've discussed before, a problem. To judge one set of parameters across all $N$ subjects, we can just take the average:

$$
\nabla\bar{L}(a,b_1,b_2) = \frac{1}{N}\sum_{i=1}^{N}\nabla L_i(a,b_1,b_2)
$$

So, now that we know how the loss changes with the parameters, we can use this information to change the parameters and lower the loss!

Let's look at $\frac{\partial \bar L}{\partial b_1}$ for a second: the derivative of the average loss with respect to $b_1$. We calculate it by averaging $(\hat{y}_i-y_i)\cdot\text{dose}_i$ across allall subjects. If this derivative is positive, increasing $b_1$ will increase the average loss, so we'll want to subtract from $b_1$. If it is negative, increasing $b_1$ will decrease the average loss, so we'll want to add to it. How much should we add or subtract? We can use a fraction of the derivative itself.

The new value will be $b_1-\eta\cdot\frac{\partial\bar L}{\partial b_1}$. If the derivative is negative, the same equation still works because subtracting a negative value results in an addition. The value $\eta$ is the **learning rate**. It is a hyperparameter: a setting that we choose outside the parameter-fitting process. It controls how large each update is. By repeatedly changing the parameters in a direction that lowers the loss, we're **learning** what parameter values fit the data.

We can do the same for all of the other parameters. Essentially, we're subtracting a scaled version of the gradient. This is where the name comes from: **gradient descent**! Et voilà, we've arrived once again.

We can also see why this works mathematically. Let $\theta$ represent all three parameters together. For a small change $\Delta\theta$, the new loss is approximately:

$$
\bar L(\theta+\Delta\theta)
\approx
\bar L(\theta)+\nabla\bar L(\theta)\cdot\Delta\theta.
$$

If we choose the change to be the negative gradient, scaled by the learning rate,

$$
\Delta\theta=-\eta\nabla\bar L(\theta),
$$

then:

$$
\bar L(\theta+\Delta\theta)
\approx
\bar L(\theta)-\eta\left\|\nabla\bar L(\theta)\right\|^2.
$$

The squared magnitude of the gradient cannot be negative. Therefore, this adjustment reduces the loss. Worst case scenario, it leaves it unchanged if the gradient is zero.

Here is the complete process in plain Python. Let's start with the data:

```python
from math import exp, log

# Each subject is: (dose, age, label)
subjects = [
    (3.2, 38, 1),  # Subject A
    (3.9, 69, 1),  # Subject B
    (3.0, 73, 0),  # Subject C
    (1.1, 43, 0),  # Subject D
    (2.0, 55, 0),  # Subject E
]
```
These five subjects are the first five subjects from the earlier widget. In this case, it's dummy data that we've just made up, but if we wanted to apply logistic regression in the real world, we would need real data. Note that we're importing the `exp` and `log` functions, as we'll need them later on.

Next, here is the logistic regression equation:
```python
def logistic_regression(dose, age, a, b1, b2):
    score = a + b1 * dose + b2 * age
    return 1 / (1 + exp(-score))
```

Now, we define the initial parameters:
```python
# Start with all three parameters at zero.
a = 0.0
b1 = 0.0
b2 = 0.0
```

After that, we define our hyperparameters:
```python
learning_rate = 0.001
number_of_steps = 5_000
```

And finally, the gradient descent loop. In each step, we change the parameters by a small amount in an attempt to decrease the loss, so we'll repeat that update many times. Note that we're also calculating the loss at each step, and for safety, we're making sure that the prediction is not exactly 0 or 1, as that would lead to infinity when taking the logarithm of the prediction or of 1 minus the prediction.

```python
for step in range(number_of_steps):
    gradient_a = 0.0
    gradient_b1 = 0.0
    gradient_b2 = 0.0
    total_loss = 0.0

    for dose, age, label in subjects:
        prediction = logistic_regression(dose, age, a, b1, b2)
        error = prediction - label

        # This subject's contribution to each partial derivative.
        gradient_a += error
        gradient_b1 += error * dose
        gradient_b2 += error * age

        # Clipping only protects log() from receiving exactly 0 or 1.
        safe_prediction = min(max(prediction, 1e-12), 1 - 1e-12)
        total_loss -= (
            label * log(safe_prediction)
            + (1 - label) * log(1 - safe_prediction)
        )

    # Average the subjects' gradients and subtract them from the parameters.
    number_of_subjects = len(subjects)
    a -= learning_rate * gradient_a / number_of_subjects
    b1 -= learning_rate * gradient_b1 / number_of_subjects
    b2 -= learning_rate * gradient_b2 / number_of_subjects

    if step % 1_000 == 0:
        average_loss = total_loss / number_of_subjects
        print(f"step={step}, average loss={average_loss:.4f}")
```

Finally, we can print the parameter values reached after 5,000 updates:
```python
print(f"a={a:.3f}, b1={b1:.3f}, b2={b2:.3f}")
```

With real-world data, we could use these parameters to predict probabilities for new subjects. We could then convert those probabilities into labels using a chosen threshold or another decision rule (a simple method could be setting a threshold of 0.5 - any predicted values above 0.5 would get the label 1).

Ok, code is cheap, show me the interactive widget that really drives the take home point:

```gradient-descent-experiment
```

If you play around with the learning rate, you'll find that the loss can get very jumpy, and it may look like we're going nowhere. That's something that can happen! Picking a good learning rate is important, and that can sometimes be a bit of an art. A good enough learning rate moves us towards lower loss, while a very large one can repeatedly overshoot.

If you let it run with the default values, you'll see the loss slowly decreasing. That's gradient descent in action, carrying out logistic regression and fitting the parameters to the data! Bam!

We've mostly focused on the drug example, learning whether or not a subject responds based on the dosage and their age. These pieces of information, dosage and age, are often called "features." They're the information that we have that will let us fit a logistic regression model. And we've used the word subjects, but the more general term is samples.

So, you can have samples, each sample having $N$ features and a label, and try to apply logistic regression to that data.

A small terminology caveat: people mostly use the word "bias" for the parameter that isn't attached to any feature, and they'll often use the letter $b$ instead of $a$. Also, parameters attached to features are mostly called "weights", and you'll often find them represented as $w$, so $w_1$ instead of $b_1$.

I think the coolest thing is that this is at the core of modern AI. Frontier LLMs can have billions or even trillions of parameters, all laid out in a specific way (an architecture), but the fundamental idea that is used to find what those parameters should be is the same as the one in this post - gradient descent! Ok, so it's not *exactly* gradient descent, but it's the same idea. :)

I hope you've enjoyed this post, and drop me an email if you have any feedback. So, down with the gradient, and happy fitting!
