.PHONY: all clean test

all: main.pdf

main.pdf: main.tex meta.tex $(wildcard sections/*.tex) $(wildcard figures/*.tex)
	pdflatex -interaction=nonstopmode main.tex
	pdflatex -interaction=nonstopmode main.tex

clean:
	rm -f *.aux *.log *.out *.toc *.pdf

test: all
